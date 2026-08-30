"""Labelling 900 crops without a labelling tool.

Fine-tuning the OCR needs a `image_path,plate_text` CSV. Typing that from scratch is
an evening; correcting a pre-filled guess is not. This writes one HTML page next to
the crops: every plate with a text box beside it, pre-filled with the current model's
best guess, and a button that saves the CSV.
"""
from __future__ import annotations

import html
import json
import re
from pathlib import Path

COUNTRY = "TN"  # what the model should learn to emit for تونس


def guess(raw: str) -> str:
    """Leading digits are the série, trailing digits the numéro, whatever the current
    model made of the country word in between."""
    head = re.match(r"^(\d{1,3})", raw)
    tail = re.search(r"(\d{1,4})$", raw)
    # The two groups must be distinct digits: on a short read they would otherwise
    # overlap and invent a plate out of a single character.
    if not (head and tail) or head.end() > tail.start():
        return ""
    return f"{head.group(1)}{COUNTRY}{tail.group(1)}"


def build_page(entries: list[tuple[str, str]], out: Path, title: str) -> Path:
    """`entries` is (image file name, pre-filled guess), relative to `out`'s folder."""
    cards = "\n".join(
        f'''<label class="card">
      <img src="{html.escape(name)}" alt="{html.escape(name)}" loading="lazy">
      <span class="name">{html.escape(name)}</span>
      <input name="{html.escape(name)}" value="{html.escape(value)}"
             spellcheck="false" autocomplete="off">
    </label>'''
        for name, value in entries
    )
    out.write_text(f"""<!doctype html>
<meta charset="utf-8">
<title>{html.escape(title)}</title>
<style>
  body {{ margin:0; padding:1.5rem 1.5rem 6rem; background:#11151b; color:#e6ebf1;
         font:15px/1.5 system-ui, sans-serif; }}
  h1 {{ font-size:1.2rem; margin:0 0 .3rem; }}
  p  {{ margin:0 0 1.5rem; color:#93a0ad; max-width:70ch; }}
  .grid {{ display:grid; gap:1rem; grid-template-columns:repeat(auto-fill,minmax(19rem,1fr)); }}
  .card {{ display:grid; gap:.4rem; padding:.7rem; background:#1a2029; border-radius:8px; }}
  img {{ width:100%; height:5.5rem; object-fit:contain; background:#000; border-radius:4px; }}
  .name {{ font:12px ui-monospace, monospace; color:#7f8b98; }}
  input {{ padding:.45rem .6rem; border:1px solid #2c343e; border-radius:5px;
           background:#11151b; color:#e6ebf1; font:15px ui-monospace, monospace;
           text-transform:uppercase; }}
  input:focus {{ outline:2px solid #4c9be8; border-color:transparent; }}
  input:placeholder-shown, input[value=""] {{ border-color:#8a5a2b; }}
  .bar {{ position:fixed; left:0; right:0; bottom:0; display:flex; gap:1rem;
          align-items:center; padding:.9rem 1.5rem; background:#1a2029;
          border-top:1px solid #2c343e; }}
  button {{ padding:.5rem 1rem; border:0; border-radius:6px; background:#4c9be8;
            color:#0b0e12; font:600 15px system-ui; cursor:pointer; }}
  #count {{ color:#93a0ad; }}
</style>
<h1>Étiquetage des plaques — {len(entries)} images</h1>
<p>Chaque case est pré-remplie par le modèle actuel : corrigez ce qui est faux, videz la
case pour écarter une image illisible. Format attendu : <code>62TN1040</code>
(série, TN, numéro). Tabulation pour passer à la suivante.</p>
<div class="grid">
{cards}
</div>
<div class="bar">
  <button type="button" id="save">Télécharger labels.csv</button>
  <span id="count"></span>
</div>
<script>
  const inputs = [...document.querySelectorAll("input")];
  const count = document.getElementById("count");
  const refresh = () => {{
    const done = inputs.filter((i) => i.value.trim()).length;
    count.textContent = `${{done}} / ${{inputs.length}} étiquetées`;
  }};
  inputs.forEach((i) => i.addEventListener("input", refresh));
  refresh();

  document.getElementById("save").addEventListener("click", () => {{
    const rows = [["image_path", "plate_text"]];
    for (const input of inputs) {{
      const value = input.value.trim().toUpperCase();
      if (value) rows.push([input.name, value]);
    }}
    const csv = rows.map((r) => r.join(",")).join("\\n");
    const url = URL.createObjectURL(new Blob([csv], {{ type: "text/csv" }}));
    const link = document.createElement("a");
    link.href = url;
    link.download = "labels.csv";
    link.click();
    URL.revokeObjectURL(url);
  }});
</script>
""")
    return out
