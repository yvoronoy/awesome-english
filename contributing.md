# Contribution Guidelines

Please note that this project is released with a
[Contributor Code of Conduct](code-of-conduct.md). By participating in this
project you agree to abide by its terms.

---

## Adding a resource

A good addition is:

- Relevant to learning English (listening, speaking, reading, writing,
  grammar, vocabulary, tools, etc.)
- A working link to the resource itself, not a review or article about it
- Described honestly in one short line

Add one line to the matching section of `readme.md`, using this format:

```md
- [Name](https://real-website-url) - Short, honest description.
```

Always use the **real destination URL** — for example `https://refold.la`,
not a link into this project's `go/` folder. Pick whichever section already
fits (Listening, Speaking, Watching, Reading, Writing, AI-Powered English
Learning, Grammar, Vocabulary, Tools, Exercises and Tests, Online Classes),
and follow that section's existing order.

> You'll notice existing entries link to `.../go/<name>/` instead of the
> real site. Those are auto-generated click-tracking redirects added by CI
> after a PR merges — you don't create or edit them yourself. Just add your
> plain link as shown above, and it gets wrapped automatically.

## Submitting

Fork the repo, add your line, and open a pull request.

## Updating your PR

A lot of times, making a PR adhere to the standards above can be difficult.
If the maintainers notice anything that we'd like changed, we'll ask you to
edit your PR before we merge it. There's no need to open a new PR, just edit
the existing one. If you're not sure how to do that,
[here is a guide](https://github.com/RichardLitt/knowledge/blob/master/github/amending-a-commit-guide.md)
on the different ways you can update your PR so that we can merge it.

Thank you for your suggestions!
