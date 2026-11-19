# How to update CUBE website images

This guide is written for the website owner. The safest update is to replace an
existing image while keeping its current filename. GitHub will then publish the
change automatically through Cloudflare Pages.

## Before uploading

Use an original photograph when possible, not a screenshot or a photo downloaded
from WhatsApp. Prepare it as follows:

- File type: JPG or WebP for photographs; PNG only for the logo.
- Shape: horizontal, ideally 16:9.
- Recommended size: about 1600 × 900 pixels.
- Maximum file size: 500 KB.
- Do not include payment details, client documents, faces without permission, or
  visible personal information.

Keep a copy of the original photograph outside GitHub.

## Existing image names

| Filename | Where it appears |
| --- | --- |
| `living.jpg` | Home-page main image and residential gallery image |
| `kitchen.jpg` | Kitchen sections and gallery |
| `office.jpg` | Commercial sections and gallery |
| `cube-logo.png` | Website logo — replace only with an approved CUBE logo |

## Safest method: replace an existing image

1. Rename the new photograph to the exact existing filename, such as
   `living.jpg`.
2. Open the GitHub repository:
   <https://github.com/rajeesh232005-cmd/cube-interiors-website>
3. Open `dist`, then open `assets`.
4. Choose **Add file**, then **Upload files**.
5. Drag the new image into the upload area.
6. In the description box, write something clear, such as
   `Replace living room photograph`.
7. Select **Commit changes**.
8. Wait approximately two minutes, then open
   <https://cube-interiors-website.pages.dev/> in a private/incognito window.

If the old picture is still visible, refresh once after a few minutes. Image files
are cached for performance and may take a short time to update everywhere.

## Adding a completely new gallery image

Adding a new card requires two changes: upload the photograph to `dist/assets`,
then add a matching gallery card to `dist/gallery.html`. This is more delicate
than replacing an image. Before the current support period ends, the recommended
method is to send the image with these details:

- Project name
- Category: Residential, Kitchen, or Commercial
- Location
- A short description of the space

If making the change manually later, first upload a safely named file such as
`kannur-bedroom-01.jpg`. Use only lowercase letters, numbers, and hyphens. Then
copy an existing `gallery-card` in `dist/gallery.html` and change only its image
filename, category, image description, and heading. Do not remove the surrounding
`gallery-grid` tags.

## How to check the update

After GitHub finishes:

1. Open the website home page and gallery page.
2. Check the image on both a phone and a computer.
3. Make sure important parts are not cropped.
4. Confirm the menu, gallery filters, animations, and contact form still work.
5. Open the GitHub **Actions** tab. The newest **Validate caretaker** run should
   show a green check mark.

## How to undo a mistake

1. Open the repository's **Commits** page.
2. Open the most recent image-update commit.
3. Choose **Revert** if GitHub offers it, then confirm the new revert commit.
4. If the Revert button is unavailable, upload the previous image again using the
   same filename.

Do not delete the `dist`, `.github`, `caretaker`, or `config` folders. They contain
the live website, automatic publishing, monitoring, and safety checks.
