# Tenddoo

Tenant wallets receive 50 free credits each week. See
[tenant wallet setup](docs/tenant-wallet.md) for grant behavior and the required
Firestore security rules.

<img width="944" height="936" alt="image" src="https://github.com/user-attachments/assets/0a02fcc5-3149-47a7-994d-e823fc936f79" />

**Challenges**

```html
<input
  type="hidden"
  name="row_DataType2550055_1_1"
  id="row_DataType2550055_1_1"
  value="1"
/>
```

Have lots of hidden input type with similar pattern `name` and `className`.

```html
<input
  type="text"
  name="row2550056_1_7"
  id="row2550056_1_7"
  onblur="chkSizeTextBox('2550056',this);"
  class="formTxtBox_2"
/>
```

Some of them have `display: none;`. You have to ignore both when applying value.

```html
<input
  type="text"
  name="row2550055_1_2"
  id="row2550055_1_2"
  style="display: none; "
  class="formTxtBox_2"
/>
```

**Note**: Never use unique `id` as a selector. Because it is unique.

## Firefox Add-ons packaging

Firefox rejected `tenddoo.zip` with `Invalid file name in archive: assets\background.js-FsPtwCBg.js` because the ZIP entries used Windows backslashes. Archive paths must use forward slashes, such as `assets/background.js-FsPtwCBg.js`.

The original `Compress-Archive` command produced the backslashes in this environment. The updated `zip.ps1` explicitly converts entry paths to forward slashes and places `manifest.json` at the archive root.

Build and package from the project directory in PowerShell.

```powershell
npm run build
.\zip.ps1
```

Upload the generated `tenddoo.zip` to Firefox Add-ons. The corrected archive was checked locally for forward-slash paths, a root manifest, and matching file counts and sizes. Full Firefox validation is still pending.
