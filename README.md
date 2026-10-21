# Roshan Ramamurthy · Portfolio

The site is `index.html`, `broverse.js` (the 3D Bro characters), and the `media/` folder (images and character models). No build step.

## Publish on GitHub Pages

1. On GitHub, create a **public** repository named exactly `Roshanr23.github.io`.
2. Upload `index.html`, `broverse.js`, and the `media` folder (and this README if you like) to the repo root: **Add file → Upload files → Commit**.
3. Go to **Settings → Pages**. Under "Build and deployment", set Source to **Deploy from a branch**, branch **main**, folder **/ (root)**, and save.
4. After a minute or two the site is live at **https://roshanr23.github.io**.

Then add that URL to your resume header, your LinkedIn "Contact info" and the website field on applications.

## Add a demo video

1. Upload the video to YouTube (Unlisted is fine) and copy its ID. The ID is the part after `v=` in `https://www.youtube.com/watch?v=Ui-3X08yqK0`.
2. In `index.html`, search for `To add a demo later`. There's a ready-made line commented out for Bro Inc., the CPR Trainer and Winter Wild:

   ```html
   <!-- To add a demo later: <div class="video" data-yt="YOUTUBE_ID" data-title="CPR Trainer demo"></div> -->
   ```

3. Replace that whole line with the uncommented tag and your ID:

   ```html
   <div class="video" data-yt="YOUR_ID_HERE" data-title="CPR Trainer demo"></div>
   ```

The page shows the video's thumbnail with a "Watch demo" button. The YouTube player loads only when someone clicks it, so the page stays fast.
