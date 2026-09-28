import { describe, expect, it } from "vitest";
import { answersFromForm, attemptsText, optionsFromForm, scoreText } from "./quiz-rules";

describe("quiz wording", () => {
  it("states a score and the attempts used", () => {
    expect(scoreText(3, 5)).toBe("3 of 5 (60%)");
    expect(scoreText(0, 0)).toBe("0 of 0 (0%)");
    expect(attemptsText(1, 3)).toBe("1 of 3 attempts used");
    expect(attemptsText(0, 1)).toBe("0 of 1 attempt used");
  });
});

describe("quiz forms", () => {
  it("reads the chosen options per question", () => {
    expect(
      answersFromForm([
        ["q:one", "b"],
        ["q:two", "a"],
        ["q:two", "c"],
        ["other", "x"],
      ]),
    ).toEqual({ one: ["b"], two: ["a", "c"] });
  });

  it("reads a question's answers, skipping empty ones, with the right one marked", () => {
    const single = new FormData();
    single.set("option1", "One year");
    single.set("option2", "  ");
    single.set("option3", "Five years");
    single.set("correct", "3");
    expect(optionsFromForm(single)).toEqual([
      { text: "One year", correct: false },
      { text: "Five years", correct: true },
    ]);
    const multiple = new FormData();
    multiple.set("option1", "Contract");
    multiple.set("correct1", "on");
    multiple.set("option2", "Leave records");
    multiple.set("correct2", "on");
    multiple.set("option3", "Lunch orders");
    expect(optionsFromForm(multiple).filter((option) => option.correct)).toHaveLength(2);
  });
});
