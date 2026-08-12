import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { Select } from "./Select";

const options = [
  { value: "0", label: "All zones" },
  { value: "1", label: "Olive terrace" },
  { value: "2", label: "Almond row" },
];

function Harness() {
  const [value, setValue] = useState("0");
  return <Select label="Scope history to a zone" value={value} options={options} onChange={setValue}/>;
}

const trigger = () => screen.getByRole("button", { name: "Scope history to a zone" });
const list = () => within(screen.getByRole("listbox", { name: "Scope history to a zone" }));
const highlighted = () => trigger().getAttribute("aria-activedescendant");

afterEach(cleanup);

describe("Select", () => {
  test("shows the selected label and keeps the list closed until asked", () => {
    render(<Harness/>);
    expect(trigger().textContent).toBe("All zones");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  test("picking an option selects it and closes the list", () => {
    render(<Harness/>);
    fireEvent.click(trigger());
    fireEvent.click(list().getByRole("option", { name: "Almond row" }));
    expect(trigger().textContent).toBe("Almond row");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  // The keyboard cursor is separate from the selection, so arrowing must not
  // commit a value until Enter.
  test("arrow keys move the cursor without selecting; Enter commits", () => {
    render(<Harness/>);
    fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    const [, second] = list().getAllByRole("option");
    fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    expect(highlighted()).toBe(second!.id);
    expect(trigger().textContent).toBe("All zones");
    fireEvent.keyDown(trigger(), { key: "Enter" });
    expect(trigger().textContent).toBe("Olive terrace");
  });

  test("the cursor stops at both ends, and Home and End jump to them", () => {
    render(<Harness/>);
    fireEvent.keyDown(trigger(), { key: "ArrowUp" });
    const items = list().getAllByRole("option");
    fireEvent.keyDown(trigger(), { key: "ArrowUp" });
    expect(highlighted()).toBe(items[0]!.id);
    fireEvent.keyDown(trigger(), { key: "End" });
    expect(highlighted()).toBe(items.at(-1)!.id);
    fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    expect(highlighted()).toBe(items.at(-1)!.id);
    fireEvent.keyDown(trigger(), { key: "Home" });
    expect(highlighted()).toBe(items[0]!.id);
  });

  test("Escape closes without changing the selection", () => {
    render(<Harness/>);
    fireEvent.click(trigger());
    fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    fireEvent.keyDown(trigger(), { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(trigger().textContent).toBe("All zones");
  });

  test("pointing outside closes the list", () => {
    render(<Harness/>);
    fireEvent.click(trigger());
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  test("marks the selected option for assistive technology", () => {
    render(<Harness/>);
    fireEvent.click(trigger());
    fireEvent.click(list().getByRole("option", { name: "Olive terrace" }));
    fireEvent.click(trigger());
    expect(list().getByRole("option", { selected: true }).textContent).toBe("Olive terrace");
  });
});
