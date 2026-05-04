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
