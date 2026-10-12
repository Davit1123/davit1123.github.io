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
