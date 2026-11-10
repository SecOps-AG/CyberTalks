import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Pagination } from "./Pagination";

describe("Pagination as links", () => {
  it("renders real hrefs, with the first page on the bare path", () => {
    const html = renderToStaticMarkup(<Pagination page={2} totalPages={9} hrefBase="/topics" />);
    assert.match(html, /<a [^>]*href="\/topics"[^>]*>Prev<\/a>/);
    assert.match(html, /href="\/topics"[^>]*>1<\/a>/);
    assert.match(html, /href="\/topics\?page=3"[^>]*>Next<\/a>/);
    assert.match(html, /href="\/topics\?page=9"[^>]*>9<\/a>/);
    assert.match(html, /aria-current="page"[^>]*>2<\/a>|>2<\/a>/);
    assert.ok(!html.includes("<button"));
  });

  it("disables the ends instead of linking off the list", () => {
    const first = renderToStaticMarkup(<Pagination page={1} totalPages={3} hrefBase="/topics" />);
    assert.match(first, /<span class="chip opacity-30" aria-disabled="true">Prev<\/span>/);
    const last = renderToStaticMarkup(<Pagination page={3} totalPages={3} hrefBase="/topics" />);
    assert.match(last, /<span class="chip opacity-30" aria-disabled="true">Next<\/span>/);
  });

  it("renders nothing for a single page and keeps buttons without hrefBase", () => {
    assert.equal(renderToStaticMarkup(<Pagination page={1} totalPages={1} hrefBase="/topics" />), "");
    const buttons = renderToStaticMarkup(<Pagination page={2} totalPages={4} onChange={() => {}} />);
    assert.ok(buttons.includes("<button"));
    assert.ok(!buttons.includes("<a "));
  });
});
