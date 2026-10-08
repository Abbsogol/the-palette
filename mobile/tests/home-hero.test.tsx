import { fireEvent, render, screen } from "@testing-library/react-native";
import { HomeHero } from "../src/features/home/home-hero";

const props = {
  width: 393,
  height: 477,
  headerTop: 24,
  onNotifications: jest.fn(),
  onFavorites: jest.fn(),
};

test("hero swipes both ways while preserving its headline and selecting only the visible photo", async () => {
  await render(<HomeHero {...props} />);
  const first = screen.getByRole("button", { name: "Show hero photo 1 of 2" });
  const second = screen.getByRole("button", { name: "Show hero photo 2 of 2" });
  expect(first).toBeSelected();
  expect(screen.queryByLabelText("Burgundy nail art with silver jewellery")).toBeNull();
  await fireEvent.scroll(screen.getByTestId("home-hero-carousel"), {
    nativeEvent: { contentOffset: { x: 393, y: 0 } },
  });
  expect(second).toBeSelected();
  expect(first).not.toBeSelected();
  expect(screen.getByLabelText("Burgundy nail art with silver jewellery")).toBeTruthy();
  expect(screen.getByRole("header", { name: "Nail & beauty design library" })).toBeTruthy();
  await fireEvent.scroll(screen.getByTestId("home-hero-carousel"), {
    nativeEvent: { contentOffset: { x: 0, y: 0 } },
  });
  expect(first).toBeSelected();
  expect(second).not.toBeSelected();
});

test("hero pagination also works without a swipe and preserves selection on resize", async () => {
  const view = await render(<HomeHero {...props} />);
  await fireEvent.press(screen.getByRole("button", { name: "Show hero photo 2 of 2" }));
  await view.rerender(<HomeHero {...props} width={320} height={388} />);
  expect(screen.getByRole("button", { name: "Show hero photo 2 of 2" })).toBeSelected();
  await fireEvent.press(screen.getByRole("button", { name: "Show hero photo 1 of 2" }));
  expect(screen.getByRole("button", { name: "Show hero photo 1 of 2" })).toBeSelected();
});

test('published slides replace initial photography, order and headline and survive a shorter revision', async()=>{
 const heroes=[{id:'published-a',imageUrl:'https://beta.invalid/a.png',alt:'Published rose',title:'Fresh nail designs',rotate:0 as const},{id:'published-b',imageUrl:'https://beta.invalid/b.png',alt:'Published chrome',title:'Chrome collection',rotate:0 as const}];
 const view=await render(<HomeHero {...props} heroes={heroes}/>);
 expect(screen.getByRole('header',{name:'Fresh nail designs'})).toBeTruthy();
 await fireEvent.press(screen.getByRole('button',{name:'Show hero photo 2 of 2'}));
 expect(screen.getByRole('header',{name:'Chrome collection'})).toBeTruthy();
 await view.rerender(<HomeHero {...props} heroes={[heroes[0]]}/>);
 expect(screen.getByRole('header',{name:'Fresh nail designs'})).toBeTruthy();
 expect(screen.getByRole('button',{name:'Show hero photo 1 of 1'})).toBeSelected();
});
