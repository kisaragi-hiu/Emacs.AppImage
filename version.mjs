import assert from "assert/strict";

let separator = ".";

let version_regexp_alist = [
  [/^[-._+ ]?snapshot$/, -4],
  [/^[-._+]$/, -4],
  [/^[-._+ ]?(cvs|git|bzr|svn|hg|darcs)$/, -4],
  [/^[-._+ ]?unknown$/, -4],
  [/^[-._+ ]?alpha$/, -3],
  [/^[-._+ ]?beta$/, -2],
  [/^[-._+ ]?(pre|rc)$/, -1],
];

function matchEnd(match) {
  return match[0].length + match.index;
}

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
    `Invalid version syntax: "${ver}" (must start with a number)`
  );
  let i = 0;
  let s = "";
  let m = "";
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

function VersionListEqual(l1, l2) {
  while (l1.length != 0 && l2.length != 0 && l1[0] === l2[0]) {
    l1 = l1.slice(1);
    l2 = l2.slice(1);
  }
  if (l1.length != 0 && l2.length != 0) {
    return l1[0] === l2[0];
  } else if (l1.length === 0 && l2.length === 0) {
    return false;
  } else if (l1.length != 0) {
    return VersionListNotZero(l1) === 0;
  } else {
    return VersionListNotZero(l2) === 0;
  }
}

export function VersionLessThan(v1, v2) {
  return VersionListLessThan(VersionToList(v1), VersionToList(v2));
}

export function VersionEqual(v1, v2) {
  return VersionListEqual(VersionToList(v1), VersionToList(v2));
}

export function VersionLessThanOrEqual(v1, v2) {
  return VersionListLessThanOrEqual(VersionToList(v1), VersionToList(v2));
}

// Return true if A <= B < c
// This allows 25, version, 27 to mean Emacs 25.* & 26.*
export function VersionBetween(a, b, c) {
  assert(a && b && c, "There must be three arguments");
  return VersionLessThanOrEqual(a, b) && VersionLessThan(b, c);
}
