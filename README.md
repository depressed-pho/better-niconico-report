# What's this

**Better Niconico Report** is a Firefox addon for providing a better
experience with Niconico Report. The addon does not replace any of the
existing portions of the site. Instead it introduces a button on the
navigation bar, which opens a page that fetches the report from the
server and displays the report in its own way.

Features include:

* Persistence between browser sessions

  This addon saves the report locally in your browser. Even after
  restarting it the addon can restore the saved state, *including the
  scroll position*.

* Automatic loading

  This addon automatically loads the entire report without requiring
  you to spam-click that annoying "show more" button. It can also
  check for updates continually.

* Improved filtering

  Although the original Niconico Report has a filtering feature, its
  usability is very limited. Say, you want to hide all those junk
  reports like "the video has been played 2525 times" but you can only
  filter them out for each specific author? This addon can do better
  than that.

* Improved noticeability

  This addon renders report entries with different background colors
  for each activity type. No more uploaded illustrations going
  overlooked.

# Installation

This addon is not listed in AMO. You can find a signed xpi file in the
"Releases" page.

# Building

```
% npm install # You only need to do this once
% npm run build
```

This will create an unsigned .zip archive in
`./dist/web-ext-artifacts`. Alternatively, by running `npm run watch`
you can also launch Firefox with a temporary profile with the addon
installed.

# License

[CC0](https://creativecommons.org/share-your-work/public-domain/cc0/)
“No Rights Reserved”
