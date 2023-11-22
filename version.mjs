/** Version comparison functions. */

import assert from "node:assert/strict";

let separator = ".";

/** @type {[RegExp, number][]} */
let version_regexp_alist = [
  [/^[-._+ ]?snapshot$/, -4],
  [/^[-._+]$/, -4],
  [/^[-._+ ]?(cvs|git|bzr|svn|hg|darcs)$/, -4],
  [/^[-._+ ]?unknown$/, -4],
  [/^[-._+ ]?alpha$/, -3],
  [/^[-._+ ]?beta$/, -2],
  [/^[-._+ ]?(pre|rc)$/, -1],
];

/** Return the absolute index of the end of `match` within its string.
 * @param {RegExpMatchArray} match - the match object
 */
function matchEnd(match) {
  return match[0].length + match.index;
}

/** Convert `ver` to an internal format that is easier to compare.
 * @param {string} ver - the version string
 */
function VersionToList(ver) {
  assert(typeof ver === "string", "Version must be a string");
  // Change .x.y to 0.x.y
  if (
    ver.length >= separator.length &&
    separator === ver.slice(0, separator.length)
  ) {
    ver = "0" + ver;
  }
  assert(
    ver.match(/^[0-9]/),
    `Invalid version syntax: "${ver}" (must start with a number)`,
  );
  let i = 0;
  let s = "";
  /** @type RegExpMatchArray */
  let m;
  let lst = [];
  while ((m = ver.slice(i).match(/[0-9]+/i)) && m?.index === 0) {
    s = m?.index;
    // Add the numeric part to the end of the version list
    lst.push(parseInt(ver.slice(i, matchEnd(m) + i)));
    i = matchEnd(m) + i;
    // Handle non-numeric part
    if ((m = ver.slice(i).match(/[^0-9]+/i)) && m?.index === 0) {
      s = ver.slice(i, matchEnd(m) + i);
      i = matchEnd(m) + i;
      // handle alpha, beta, pre, etc. separator
      if (!(s === separator)) {
        let al = version_regexp_alist;
        while (al.length != 0 && !s.match(al[0][0])) {
          al = al.slice(1);
        }
        if (al.length != 0) {
          lst.push(al[0][1]);
        } else if ((m = s.match(/^[-._+ ]?([a-zA-Z])$/)) && i === ver.length) {
          // a -> 1, b -> 2, etc.
          let n = m[1].toLowerCase().codePointAt[0] - 97 + 1;
          lst.push(n);
        } else {
          throw Error(`Invalid version syntax: ${ver}`);
        }
      }
    }
  }
  return lst;
}

/**
 * Return the first non-zero element of `lst`, which is an array of integers.
 * If all `lst` elements are zeros or `lst` is empty, return zero.
 * Port of Emacs Lisp `version-list-not-zero`.
 * @param {number[]} lst
 */
function VersionListNotZero(lst) {
  while (lst.length != 0 && lst[0] === 0) {
    lst = lst.slice(1);
  }
  if (lst.length != 0) {
    return lst[0];
  } else {
    return 0;
  }
}

/**
 * Return true if `l1` is lower (older) than or equal to `l2`.
 * Port of Emacs Lisp `version-list-<=`.
 * @param {number[]} l1 - return true if this is <= l2
 * @param {number[]} l2 - return true if this is > l1
 */
function VersionListLessThanOrEqual(l1, l2) {
  while (l1.length != 0 && l2.length != 0 && l1[0] === l2[0]) {
    l1 = l1.slice(1);
    l2 = l2.slice(1);
  }
  if (l1.length != 0 && l2.length != 0) {
    return l1[0] < l2[0];
  } else if (l1.length === 0 && l2.length === 0) {
    return false;
  } else if (l1.length != 0) {
    return VersionListNotZero(l1) <= 0;
  } else {
    return 0 <= VersionListNotZero(l2);
  }
}

/**
 * Return true if `l1` is lower (older) than `l2`.
 * Port of Emacs Lisp `version-list-<`.
 * @param {number[]} l1 - return true if this is < l2
 * @param {number[]} l2 - return true if this is >= l1
 */
function VersionListLessThan(l1, l2) {
  while (l1.length != 0 && l2.length != 0 && l1[0] === l2[0]) {
    l1 = l1.slice(1);
    l2 = l2.slice(1);
  }
  if (l1.length != 0 && l2.length != 0) {
    return l1[0] < l2[0];
  } else if (l1.length === 0 && l2.length === 0) {
    return false;
  } else if (l1.length != 0) {
    return VersionListNotZero(l1) < 0;
  } else {
    return 0 < VersionListNotZero(l2);
  }
}

/**
 * Return true if `l1` is equivalent to `l2`.
 * Port of Emacs Lisp `version-list-=`.
 * @param {number[]} l1 - return true if this is = l2
 * @param {number[]} l2 - return true if this is = l1
 */
function VersionListEqual(l1, l2) {
  while (l1.length != 0 && l2.length != 0 && l1[0] === l2[0]) {
    l1 = l1.slice(1);
    l2 = l2.slice(1);
  }
  if (l1.length != 0 && l2.length != 0) {
    return false;
  } else if (l1.length === 0 && l2.length === 0) {
    return true;
  } else if (l1.length != 0) {
    return VersionListNotZero(l1) <= 0;
  } else {
    return 0 <= VersionListNotZero(l2);
  }
}

/** Return true if version `v1` is lower (older) than `v2`.
 *
 * Note that version string "1" is equal to "1.0", "1.0.0", "1.0.0.0",
 * etc. That is, the trailing ".0"s are insignificant. Also, version
 * string "1" is higher (newer) than "1pre", which is higher than
 * "1beta", which is higher than "1alpha", which is higher than
 * "1snapshot". Also, "-GIT", "-CVS" and "-NNN" are treated as
 * snapshot versions.
 *
 * Port of Emacs Lisp `version<`.
 *
 * @param v1 {string}
 * @param v2 {string}
 */
export function VersionLessThan(v1, v2) {
  return VersionListLessThan(VersionToList(v1), VersionToList(v2));
}

/** Return true if version `v1` is equal to `v2`.
 *
 * Note that version string "1" is equal to "1.0", "1.0.0", "1.0.0.0",
 * etc. That is, the trailing ".0"s are insignificant. Also, version
 * string "1" is higher (newer) than "1pre", which is higher than
 * "1beta", which is higher than "1alpha", which is higher than
 * "1snapshot". Also, "-GIT", "-CVS" and "-NNN" are treated as
 * snapshot versions.
 *
 * Port of Emacs Lisp `version=`.
 *
 * @param v1 {string}
 * @param v2 {string}
 */
export function VersionEqual(v1, v2) {
  return VersionListEqual(VersionToList(v1), VersionToList(v2));
}

/** Return true if version `v1` is lower (older) than or equal to `v2`.
 *
 * Note that version string "1" is equal to "1.0", "1.0.0", "1.0.0.0",
 * etc. That is, the trailing ".0"s are insignificant. Also, version
 * string "1" is higher (newer) than "1pre", which is higher than
 * "1beta", which is higher than "1alpha", which is higher than
 * "1snapshot". Also, "-GIT", "-CVS" and "-NNN" are treated as
 * snapshot versions.
 *
 * Port of Emacs Lisp `version<=`.
 * @param v1 {string}
 * @param v2 {string}
 */
export function VersionLessThanOrEqual(v1, v2) {
  return VersionListLessThanOrEqual(VersionToList(v1), VersionToList(v2));
}

/** Return true if `a` <= `b` < `c`.
 *
 * For example, `VersionBetween("25", version, "27")` returns true for
 * 25.* and 26.*.
 * @param a {string}
 * @param b {string}
 * @param c {string}
 */
export function VersionBetween(a, b, c) {
  assert(a && b && c, "There must be three arguments");
  return VersionLessThanOrEqual(a, b) && VersionLessThan(b, c);
}
