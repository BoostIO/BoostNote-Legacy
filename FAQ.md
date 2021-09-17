# Frequently Asked Questions

<details><summary>Allowing dangerous HTML tags</summary>

Sometimes it is useful to allow dangerous HTML tags to add interactivity to your notebook. One of the example is to use details/summary as a way to expand/collaps your todo-list.

- How to enable:
  - Go to **Preferences** → **Interface** → **Sanitization** → **Allow dangerous html tags**
- Example note: Multiple todo-list

  - Create new notes
  - Paste the below code, and you'll see that you can expand/collaps the todo-list, and you can have multiple todo-list in your note.

```html
<details
  ><summary>What I want to do</summary>

  - [x] Create an awesome feature X - [ ] Do my homework
</details>
```

</details>

## Other questions

You can ask [here][issues]

[issues]: https://github.com/BoostIO/Boostnote/issues
