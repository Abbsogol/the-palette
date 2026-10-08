import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import {
  DesignEditor,
  emptyDesign,
  draftDetail,
} from "../src/features/design-detail/editor";
import { SocialComposer } from "../src/features/social/composer";
import { CommunityFeed } from "../src/features/social/feed";
import { ProfileForm } from "../src/features/secondary/profile-form";
import { TagPeople } from "../src/features/social/people";

import LabPreview from "../src/preview/lab";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
const initial = {
  ...emptyDesign,
  title: "Cathedral",
  description: "Sculpted ivory arches",
  shape: "Stiletto",
  length: "Long",
  technique: "Gel, 3D gel",
  photos: [{ value: "photo", preview: "https://example.invalid/photo.webp" }],
};
test("design editor captures D36 specifications and preserves them after a failed save", async () => {
  const save = jest.fn().mockRejectedValue(new Error("Offline"));
  await render(
    <DesignEditor initial={initial} onPick={jest.fn()} onSave={save} />,
  );
  await fireEvent.press(screen.getByRole("button", { name: "Add colour" }));
  await fireEvent.changeText(screen.getByLabelText("Colour name 1"), "Ivory");
  await fireEvent.changeText(screen.getByLabelText("Hex code 1"), "#D8D4CC");
  await fireEvent.changeText(screen.getByLabelText("Tags"), "#ivory #gothic");
  await fireEvent.press(screen.getByRole("button", { name: "Publish design" }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      colours: [
        expect.objectContaining({ colour_name: "Ivory", hex_code: "#D8D4CC" }),
      ],
      tags: "#ivory #gothic",
    }),
    true,
  );
  expect(screen.getByText("Offline")).toBeTruthy();
  expect(screen.getByLabelText("Description").props.value).toBe(
    initial.description,
  );
});
test("publishing requires real specifications and opening preview does not submit", async () => {
  const save = jest.fn(),
    preview = jest.fn();
  await render(
    <DesignEditor
      initial={{ ...initial, technique: "" }}
      onPick={jest.fn()}
      onSave={save}
      onPreview={preview}
    />,
  );
  await fireEvent.press(screen.getByRole("button", { name: "Publish design" }));
  expect(save).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole("button", { name: "Preview design page" }),
  );
  expect(preview).toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
});
test("metadata preview uses the current design’s photos and splits technique tags", () => {
  const d = draftDetail({
    ...initial,
    photos: [...initial.photos, { value: "close", preview: "close.webp" }],
    colours: [
      {
        colour_name: "Ivory",
        hex_code: "#D8D4CC",
        brand_name: "",
        brand_code: "",
      },
    ],
    tags: "#ivory",
  });
  expect(d.techniques).toEqual(["Stiletto", "Long", "Gel", "3D gel"]);
  expect(d.closeups[0].source).toBe("close.webp");
  expect(d.tags).toEqual(["ivory"]);
});
test("Lab history opens D36, offers share with my nail tech and no community-publish shortcut", async () => {
  await render(<LabPreview width={393} />);
  await fireEvent.press(screen.getByRole("button", { name: "History" }));
  await fireEvent.press(
    screen.getAllByRole("button", { name: /Open generation:/ })[0],
  );
  expect(
    screen.getByRole("button", { name: "Share with my nail tech" }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Publish to community" }),
  ).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "Share with my nail tech" }),
  );
  expect(screen.getByText("Share to Chat")).toBeTruthy();
});
test("a community post accepts video, caption and hashtags without design-spec fields", async () => {
  const post = jest.fn().mockResolvedValue(undefined);
  await render(
    <SocialComposer
      kind="post"
      onClose={jest.fn()}
      onPick={async () => ({ type: "video", uri: "file:///clip.mp4" })}
      onPost={post}
      searchPeople={async () => []}
    />,
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Choose photo or video" }),
  );
  await fireEvent.changeText(screen.getByLabelText("Caption"), "Fresh set");
  await fireEvent.changeText(
    screen.getByLabelText("Hashtags"),
    "#nailart #fresh",
  );
  await fireEvent.press(screen.getByRole("button", { name: "Share post" }));
  expect(post).toHaveBeenCalledWith(
    expect.objectContaining({
      caption: "Fresh set",
      tags: ["nailart", "fresh"],
      media: [{ type: "video", uri: "file:///clip.mp4" }],
    }),
    expect.any(Function),
  );
  expect(screen.queryByLabelText("Shape")).toBeNull();
});
test("a failed story keeps its payload locked for safe retry", async () => {
  const post = jest
    .fn()
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValue(undefined);
  await render(
    <SocialComposer
      kind="story"
      onClose={jest.fn()}
      onPick={async () => ({ type: "image", uri: "photo" })}
      onPost={post}
      searchPeople={async () => []}
    />,
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Choose photo or video" }),
  );
  await fireEvent.changeText(screen.getByLabelText("Caption"), "A moment");
  await fireEvent.press(screen.getByRole("button", { name: "Share story" }));
  expect(screen.getByLabelText("Caption")).toHaveProp("editable", false);
  await fireEvent.press(screen.getByRole("button", { name: "Retry posting" }));
  expect(post.mock.calls[1][0]).toEqual(post.mock.calls[0][0]);
});
test("tagging resolves a real account ID instead of trusting a typed name", async () => {
  const change = jest.fn(),
    person = { id: "stable-person", username: "sarah.nails", name: "Sarah" };
  await render(
    <TagPeople value={[]} onChange={change} search={async () => [person]} />,
  );
  await fireEvent.changeText(screen.getByLabelText("Tag people"), "@sarah");
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "@sarah.nails · Sarah" }),
    ).toBeTruthy(),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "@sarah.nails · Sarah" }),
  );
  expect(change).toHaveBeenCalledWith([person]);
});
test("profile ID is normalized, dot handles work, and unavailable usernames keep entered details", async () => {
  const save = jest
    .fn()
    .mockRejectedValue(new Error("That username is already taken"));
  await render(
    <ProfileForm
      initial={{ display_name: "Sarah", username: "@Sarah.Nails" }}
      onSave={save}
    />,
  );
  await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ username: "sarah.nails" }),
    { avatar: undefined, banner: undefined },
  );
  expect(screen.getByText("That username is already taken")).toBeTruthy();
  expect(screen.getByLabelText("Username").props.value).toBe("@Sarah.Nails");
});
test("tagged account links in posts open the tagged person, not the post author", async () => {
  const profile = jest.fn();
  await render(
    <CommunityFeed
      posts={[
        {
          id: "post",
          userId: "author",
          name: "Kimia",
          username: "kimia",
          createdAt: new Date().toISOString(),
          caption: "Fresh set",
          media: [],
          tags: ["nailart"],
          people: [{ id: "tagged", username: "sarah.nails", name: "Sarah" }],
        },
      ]}
      onRetry={jest.fn()}
      onProfile={profile}
    />,
  );
  await fireEvent.press(screen.getByRole("link", { name: "@sarah.nails" }));
  expect(profile).toHaveBeenCalledWith("tagged");
});

test("existing designs keep a confirmed delete action and show failures without losing metadata", async () => {
  const remove = jest.fn().mockRejectedValue(new Error("Delete failed"));

  await render(
    <DesignEditor
      initial={initial}
      onPick={jest.fn()}
      onSave={jest.fn()}
      onDelete={remove}
    />,
  );
  await fireEvent.press(screen.getByRole("button", { name: "Delete design" }));
  expect(remove).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole("button", { name: "Confirm delete design" }),
  );
  expect(screen.getByText("Delete failed")).toBeTruthy();
  expect(screen.getByLabelText("Design title").props.value).toBe("Cathedral");
});
