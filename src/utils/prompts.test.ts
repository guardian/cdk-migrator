import prompts from "prompts";
import type { PromptObject } from "prompts";
import { mocked } from "ts-jest/utils";
import { cancellablePrompts } from "./prompts";

jest.mock("prompts");
const mockedPrompts = mocked(prompts, true);

describe("The cancellablePrompts function", () => {
  beforeEach(() => {
    mockedPrompts.mockClear();
  });

  const question: PromptObject = {
    type: "text",
    name: "test",
    message: "This is a test",
  };

  test("passes through the questions with no change", async () => {
    await cancellablePrompts(question);

    expect(mockedPrompts.mock.calls[0][0]).toEqual(question);
  });

  test("adds the onCancel function", async () => {
    await cancellablePrompts(question);

    expect(Object.keys(mockedPrompts.mock.calls[0][1])).toEqual(["onCancel"]);
  });

  test("merges other options", async () => {
    await cancellablePrompts(question, {
      onSubmit: () => {
        return true;
      },
    });

    expect(Object.keys(mockedPrompts.mock.calls[0][1])).toEqual([
      "onCancel",
      "onSubmit",
    ]);
  });

  test("overrides onCancel if passed through", async () => {
    await cancellablePrompts(question, {
      onCancel: () => "test",
    });

    expect(
      mockedPrompts.mock.calls[0][1].onCancel({} as PromptObject, "b")
    ).toBe("test");
  });
});