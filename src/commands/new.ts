// TODO: Can we avoid disabling all of these rules?
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- Prompts breaks this but its an external module so there's nothing we can do about it  */
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Prompts breaks this but its an external module so there's nothing we can do about it */

import { basename, dirname } from "path";
import { Command, flags } from "@oclif/command";
import kebabCase from "lodash.kebabcase";
import { constructApp } from "../utils/app";
import { checkPathDoesNotExist, checkPathExists } from "../utils/args";
import { newAppImports, newStackImports } from "../utils/imports";
import { cancellablePrompts } from "../utils/prompts";
import type { StackTemplate } from "../utils/stack";
import { constructStack } from "../utils/stack";

interface NewCommandConfig {
  cdkDir: string;
  multiApp: boolean;
  appPath: string;
  appName: string;
  stackPath: string;
  stackName: string;
}

interface NewCommandArgs {
  output: string;
  app: string;
  stack: string;
}

interface NewCommandFlags {
  "multi-app": boolean;
}

export class NewCommand extends Command {
  static description = "Creates a new CDK stack";

  static flags = {
    version: flags.version({ char: "v" }),
    help: flags.help({ char: "h" }),
    "multi-app": flags.boolean(),
  };

  static args = [
    {
      name: "output",
      required: true,
      description: "The CDK directory to create the new files in",
    },
    {
      name: "app",
      required: true,
      description: "A name to give the app",
    },
    {
      name: "stack",
      required: true,
      description: "A name to give the stack",
    },
  ];

  imports = newStackImports();

  template: StackTemplate = {
    Parameters: {},
  };
  static getConfig = ({
    args,
    flags,
  }: {
    args: NewCommandArgs;
    flags: NewCommandFlags;
  }): NewCommandConfig => {
    const cdkDir = args.output;
    const appName = args.app;
    const kebabAppName = kebabCase(appName);
    const stackName = args.stack;
    const kebabStackName = kebabCase(stackName);

    const config = {
      cdkDir,
      multiApp: flags["multi-app"],
      appName,
      appPath: `${cdkDir}/bin/${kebabAppName}.ts`,
      stackName,
      stackPath: `${cdkDir}/lib/${
        flags["multi-app"] ? `${kebabAppName}/` : ""
      }${kebabStackName}.ts`,
    };

    NewCommand.validateConfig(config);

    return config;
  };

  static validateConfig = (config: NewCommandConfig): void => {
    checkPathExists(config.cdkDir); // TODO: Add an option to init the CDK dir at the same time?
    checkPathDoesNotExist(config.appPath); // TODO: Update the app file if it already exists
    checkPathDoesNotExist(config.stackPath);
  };

  async run(): Promise<void> {
    this.log("Starting CDK generator");

    const config = NewCommand.getConfig(this.parse(NewCommand));

    this.log(`New app ${config.appName} will be written to ${config.appPath}`);
    this.log(
      `New stack ${config.stackName} will be written to ${config.stackPath}`
    );

    await this.getParameters();

    await constructApp({
      appName: config.appName,
      outputFile: basename(config.appPath),
      outputDir: dirname(config.appPath),
      stacks: [{ name: config.stackName }],
      imports: newAppImports(config.stackName, config.appName, config.multiApp),
      comment: `// This file was autogenerated when creating ${basename(
        config.stackPath
      )} using @guardian/cdk-cli\n// It is a starting point for migration to CDK *only*. Please check the output carefully before deploying`,
    });

    await constructStack({
      imports: this.imports,
      template: this.template,
      stackName: config.stackName,
      outputFile: basename(config.stackPath),
      outputDir: dirname(config.stackPath),
      comment: "// This file was autogenerated using @guardian/cdk-cli",
    });
  }

  async getParameters(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, no-constant-condition -- while true for the win, what could go wrong?
    while (true) {
      const nameResponse = await cancellablePrompts({
        type: "text",
        name: "parameterName",
        message: "Enter the name of the parameter (or hit enter to finish):",
      });

      if (!nameResponse.parameterName) break;

      const name = nameResponse.parameterName;

      // TODO: Can we be more clever here about the available types?
      const typeResponse = await cancellablePrompts({
        type: "text",
        name: "parameterType",
        message: "Enter the parameter type:",
        initial: "string",
      });

      const type = typeResponse.parameterType as string;

      if (type.toLowerCase() === "string") {
        this.template.Parameters[name] = {
          parameterType: "GuStringParameter",
        };

        this.imports.addImport("@guardian/cdk/lib/constructs/core", [
          "GuStringParameter",
        ]);
      } else {
        this.template.Parameters[name] = {
          parameterType: "GuParameter",
          type,
        };

        this.imports.addImport("@guardian/cdk/lib/constructs/core", [
          "GuParameter",
        ]);
      }
    }
  }
}
