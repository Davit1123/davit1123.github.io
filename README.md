# davit1123.github.io

Source for the personal website of Davit Gogolashvili: <https://davit1123.github.io>

The site is built with [Jekyll](https://jekyllrb.com/) and the [al-folio](https://github.com/alshedivat/al-folio) theme.

## Editing content

| To change | Edit |
| --- | --- |
| Bio, photo, contact email | `_pages/about.md` (the photo is `assets/img/prof_pic.jpg`) |
| Publications | `_bibliography/papers.bib` |
| Years shown on the publications page | `years` in `_pages/publications.md` |
| CV | `_data/cv.yml` |
| Name, social links, site-wide options | `_config.yml` |

A publication appears only if its `year` is in the `years` list, so add the new year there when adding the first paper of that year.

## Reading group page

The page at `/reading-group/` ("Statistical Theory of Transformers") is unlisted: no other page links to it, and it is left out of the sitemap. It also shows no site navigation at the top, because its front matter sets `standalone: true`.

| To change | Edit |
| --- | --- |
| Introductory text, organizer, group, meetings, reading program | `_data/reading_group.yml` |
| Page title and layout | `_pages/reading-group.html` |

Meeting details are shown only once they are filled in. `_data/reading_group.yml` is public, so a Zoom link entered there is visible to everyone.

### Paper suggestions

Anyone with the page link can suggest a paper; no account is needed. The site is static, so suggestions are stored in a Google Sheet:

- The form on the page sends each suggestion to a small script attached to the sheet (`_backend/reading-group-suggestions.gs`).
- The script checks the suggestion, refuses papers already in the reading program or already suggested (it compares the link, ignoring arXiv versions and PDF variants, and the title), and adds a row to the sheet.
- The page reads the rows back from the same script and lists them under "Suggested papers".

To remove a suggestion from the page, delete its row in the sheet. The script finds its columns by their headings, so you can reorder columns or add your own (for notes), but do not rename the headings it created. It accepts at most 30 new suggestions per hour and 500 in total.

One-time setup:

1. Create a Google Sheet (for example at <https://sheets.new>) in your Google account.
2. In the sheet, open **Extensions → Apps Script**. Replace the sample code with the contents of `_backend/reading-group-suggestions.gs` and save.
3. Click **Deploy → New deployment**, choose the type **Web app**, set **Execute as** to *Me* and **Who has access** to *Anyone*, and click **Deploy**. Approve the access request when Google asks.
4. Copy the **Web app URL** (it ends in `/exec`) into `suggestions.endpoint` in `_data/reading_group.yml`, then publish the site.

Until the address is set, the page shows no form and says that suggestions are not open yet.

After changing the script, paste it into the script editor again and use **Deploy → Manage deployments → Edit → New version**, which keeps the same address.

## Local preview

The only requirement is [Docker](https://www.docker.com/). From the repository root:

```bash
docker compose up
```

Then open <http://localhost:8080>. The first start takes a few minutes, because it downloads the image and installs gems.

Saved edits are rebuilt and reloaded in the browser automatically. Changes to `_config.yml` take effect only after restarting the command. Press `Ctrl-C` to stop the preview.

## Publishing

Pushing to `master` publishes the site. The workflow in `.github/workflows/deploy.yml` builds it and commits the result to the `gh-pages` branch, which GitHub Pages serves. The update is usually live a few minutes after the push.

## Credits

The theme is [al-folio](https://github.com/alshedivat/al-folio) by Maruan Al-Shedivat, used under the MIT license (see `LICENSE`). Some of the theme's sample posts, projects, and bibliography entries are still in the repository; they are not linked from the site.
