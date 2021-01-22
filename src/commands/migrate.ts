import { basename, dirname } from "path";
import { Command, flags } from "@oclif/command";
import kebabCase from "lodash.kebabcase";
import { constructApp } from "../utils/app";
import {
  checkPathDoesNotExist,
  checkPathExists,
  getStackNameFromFileName,
} from "../utils/args";
import { parse } from "../utils/cfn";
import { newAppImports, newTestImports } from "../utils/imports";
import { constructStack } from "../utils/stack";
import { constructTest } from "../utils/snapshot";

interface MigrateCommandConfig {
  cfnPath: string;
  cfnFile: string;
  cdkDir: string;
  multiApp: boolean;
  appPath: string;
  appName: string;
  stackPath: string;
  stackName: string;
  testPath: string;
}

interface MigrateCommandArgs {
  template: string;
  output: string;
  app: string;
  stack?: string;
}

interface MigrateCommandFlags {
  "multi-app": boolean;
}

export class MigrateCommand extends Command {
  static description =
    "Migrates from a cloudformation template to Guardian flavoured CDK";

  static flags = {
    version: flags.version({ char: "v" }),
    help: flags.help({ char: "h" }),
    "multi-app": flags.boolean(),
  };

  static args = [
    {
      name: "template",
      required: true,
      description: "The template file to migrate",
    },
    {
      name: "output",
      required: true,
      description: "The CDK directory to migrate the stack to",
    },
    {
      name: "app",
      required: true,
      description: "The name of the app that the stack belongs to",
    },
    {
      name: "stack",
      required: false,
      description: "A name to give the stack. Defaults to match the filename.",
    },
  ];

  static getConfig = ({
    args,
    flags,
  }: {
    args: MigrateCommandArgs;
    flags: MigrateCommandFlags;
  }): MigrateCommandConfig => {
    const cfnFile = basename(args.template);
    const cdkDir = args.output;
    const appName = args.app;
    const kebabAppName = kebabCase(appName);
    const stackName = args.stack ?? getStackNameFromFileName(cfnFile);
    const kebabStackName = kebabCase(stackName);

    const config = {
      cfnPath: args.template,
      cfnFile,
      cdkDir,
      multiApp: flags["multi-app"],
      appName,
      appPath: `${cdkDir}/bin/${kebabAppName}.ts`,
      stackName,
      stackPath: `${cdkDir}/lib/${
        flags["multi-app"] ? `${kebabAppName}/` : ""
      }${kebabStackName}.ts`,
      testPath: `${cdkDir}/lib/${
        flags["multi-app"] ? `${kebabAppName}/` : ""
      }${kebabStackName}.test.ts`,
    };

    MigrateCommand.validateConfig(config);

    return config;
  };

  static validateConfig = (config: MigrateCommandConfig): void => {
    // TODO: Do some better validation here to make sure that files and directories are what we expect them to be.
    checkPathExists(config.cfnPath);
    checkPathExists(config.cdkDir); // TODO: Add an option to init the CDK dir at the same time?
    checkPathDoesNotExist(config.appPath); // TODO: Update the app file if it already exists
    checkPathDoesNotExist(config.stackPath);
  };

  async run(): Promise<void> {
    this.log("Starting CDK generator");

    const config = MigrateCommand.getConfig(this.parse(MigrateCommand));

    this.log(`Converting template found at ${config.cfnPath}`);
    this.log(`New app ${config.appName} will be written to ${config.appPath}`);
    this.log(
      `New stack ${config.stackName} will be written to ${config.stackPath}`
    );

    await constructApp({
      appName: config.appName,
      outputFile: basename(config.appPath),
      outputDir: dirname(config.appPath),
      stacks: [{ name: config.stackName }],
      imports: newAppImports(config.stackName, config.appName, config.multiApp),
      migrated: true,
      comment: `// This file was autogenerated when migrating ${basename(
        config.stackPath
      )} using @guardian/cdk-cli\n// It is a starting point for migration to CDK *only*. Please check the output carefully before deploying`,
    });

    const { imports, template } = parse(config.cfnPath);

    await constructStack({
      stackName: config.stackName,
      outputFile: basename(config.stackPath),
      outputDir: dirname(config.stackPath),
      imports,
      template,
      comment: `// This file was autogenerated from ${basename(
        config.stackPath
      )} using @guardian/cdk-cli\n// It is a starting point for migration to CDK *only*. Please check the output carefully before deploying`,
    });

    await constructTest({
      stackName: config.stackName,
      appName: config.appName,
      outputFile: basename(config.testPath),
      outputDir: dirname(config.stackPath),
      imports: newTestImports(config.stackName),
      comment: `// This file was autogenerated from ${basename(
        config.stackPath
      )} using @guardian/cdk-cli\n// It is a starting point for migration to CDK *only*. Please check the output carefully before deploying`,
    });
  }
}
