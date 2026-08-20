# Fonts

Both families are [SIL Open Font License 1.1](https://scripts.sil.org/OFL) —
see `OFL-Newsreader.txt` and `OFL-IBMPlexMono.txt`. They are self-hosted rather
than loaded from Google Fonts: no third-party origin, no extra DNS + TLS
handshake, and the files are immutable so they cache indefinitely.

| File | Family | Notes |
|---|---|---|
| `newsreader-roman-var.woff2` | Newsreader | Variable. `opsz` 6–72 kept in full — the page runs one serif from 11px marginalia to a 132px masthead, and the optical-size axis is what makes both ends look right. `wght` instanced to 300–500, the only weights used. |
| `newsreader-italic.woff2` | Newsreader Italic | `wght` 300–500, `opsz` **pinned to 20**. Italic never appears outside 16–32px, so the axis bought nothing and cost 71 KB. |
| `plex-mono-400.woff2` | IBM Plex Mono 400 | Skill index, project stacks, contact lines. |
| `plex-mono-500.woff2` | IBM Plex Mono 500 | Running head, rail dates, every label and caption. |

180 KB total, down from 301 KB unsubset. All four carry Latin plus the
punctuation the site actually uses: arrows, en/em dashes, middot, curly quotes,
×, ©, é.

## Regenerating

```bash
pip install "fonttools[woff]" brotli

# 1. Fetch the latin-subset woff2 URLs from the Google Fonts CSS2 API with a
#    modern browser User-Agent, then download them.
# 2. Narrow the axes:
python -m fontTools.varLib.instancer newsreader-roman.woff2  wght=300:500          -o roman.ttf
python -m fontTools.varLib.instancer newsreader-italic.woff2 wght=300:500 opsz=20  -o italic.ttf

# 3. Subset to the charset the site uses:
UNI="U+0020-007E,U+00A0-00FF,U+0131,U+0152-0153,U+2010-2015,U+2018-201A,\
U+201C-201E,U+2020-2022,U+2026,U+2030,U+2032-2033,U+2039-203A,U+2044,U+20AC,\
U+2122,U+2190-2193,U+2212,U+2215,U+FB01-FB02,U+FEFF,U+FFFD"
python -m fontTools.subset roman.ttf --unicodes="$UNI" \
  --layout-features='kern,liga,calt,ccmp,locl,mark,mkmk,tnum,lnum' \
  --flavor=woff2 --output-file=newsreader-roman-var.woff2
```

`tools/og.py` instances these same files when it draws the social card, so the
card can never drift from what the site renders.
