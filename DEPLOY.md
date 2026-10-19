# Deploying the portfolio

Only the **contents of `site/`** are ever published. Everything else in this
folder (reference PDFs and original photos in the project root) stays private.

---

## Option A: University homepage (current plan)

**Do not upload until ZIM has confirmed by email that this use is fine.**
If ZIM says you need an Impressum or privacy notice, add that page first.

Your address will be: `https://homepages.uni-paderborn.de/<username>/`

### First time only

1. Go to the [Serviceportal](https://serviceportal.uni-paderborn.de) and enable the
   option **"Netzwerkspeicher"** (network storage). This creates your home directory.
2. Add the footer disclaimer to the four pages (`site/index.html` and the three `site/projects/*/index.html`),
   just before `</div>` inside `<footer>`. The styling for it is already in the stylesheet:

   ```html
   <p class="footer-note">Personal website. Universität Paderborn is not responsible for its content.</p>
   ```

3. Write your address into the pages (needed for LinkedIn link previews and search engines):

   ```
   python tools/set_base_url.py https://homepages.uni-paderborn.de/<username>/
   ```

### Every upload

1. **Off campus:** connect to the university VPN. On campus with eduroam, skip this.
2. **Open the network drive:** File Explorer → This PC → *Map network drive* →
   `\\fs-cifs.uni-paderborn.de\home` → log in with your Uni-Account.
3. Open the folder **`public\https`**.
4. Copy everything **inside** `site\` into `public\https`, **except `404.html` and `.nojekyll`**
   (those are only used by GitHub Pages). It should look like this:

   ```
   public\https\index.html
   public\https\robots.txt
   public\https\assets\...
   public\https\projects\...
   ```

5. Open `https://homepages.uni-paderborn.de/<username>/` and run the checks below.

### Checks after uploading

- [ ] Home page loads with the right fonts and colours
- [ ] Your photo and the project screenshots appear
- [ ] Each project's **Details** page opens and its charts draw
- [ ] The **Resume** button downloads the CV
- [ ] It looks right on your phone
- [ ] [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/) shows the preview card for your address

### If something goes wrong

| Problem | Fix |
|---|---|
| **403 Forbidden** | The files aren't readable by the web server. Check the permissions on `public\https`, or ask ZIM. |
| Page has no styling, or the address ends in `/site/` | You copied the `site` folder itself. Copy its **contents** instead. |
| You still see the old version | Your browser cache: press Ctrl+F5. |

### Never upload

- Anything from outside `site\`: the reference PDFs and photos in the project root.
- Anything into `public\share`: every user of the university network storage can read that folder.

### Before you graduate

The homepage is deleted together with your Uni-Account after your studies end.
Move the site to Option B in time and update the link on your CV and LinkedIn.

---

## GitHub Pages (live)

The repo `abhiwalikar1999.github.io` keeps the full project on `main`. GitHub Pages serves the
`gh-pages` branch, which contains only the contents of `site/`.

To publish a change:

```
python tools/check_links.py
git add -A
git commit -m "Latest commit"
git push
git subtree push --prefix site origin gh-pages
```

The site updates within a minute or two. `.gitignore` keeps the reference PDFs and photos out of the repo.

Before a university upload, run `set_base_url.py` with the university address and add the footer line
(steps 2 and 3 above). Afterwards, undo both before the next push to GitHub.
