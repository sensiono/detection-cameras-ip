#!/usr/bin/env python3
"""Assemble planches.html : les cinq SVG inlinés dans une page consultable.

Régénérer après chaque `plantuml -tsvg` :  python3 docs/uml/build_planches.py
"""
from __future__ import annotations

import pathlib
import re

HERE = pathlib.Path(__file__).parent

PLATES = [
    ("01", "§ 8 · tiret 1", "Cas d'utilisation", "cas-utilisation.svg", "01-cas-utilisation.puml",
     "Deux acteurs humains et une généralisation : l'administrateur <em>est</em> un agent de "
     "supervision qui peut en plus écrire. La caméra est un acteur à part entière — elle déclenche "
     "des cas d'utilisation que personne ne demande. « Vérifier la vivacité » est inclus dans la "
     "détection, pas optionnel : sans lui, une photo suffit à pointer."),
    ("02", "§ 8 · tiret 2", "Classes", "classes.svg", "02-classes.puml",
     "Deux paquetages qui ne partagent aucune classe. À gauche le service de reconnaissance, avec "
     "ses deux protocoles — <code>Recognizer</code> et <code>EventSink</code> — qui sont les seuls "
     "points d'extension. À droite les cinq tables du § 9. Le seul lien entre les deux mondes est "
     "une requête HTTP, pas un import."),
    ("03", "§ 8 · tiret 3", "Séquence — pointage", "sequence-pointage.svg", "03-sequence-pointage.puml",
     "La chaîne demandée par le cahier : détection → reconnaissance → enregistrement. Trois "
     "fragments <code>alt</code> en gardent l'entrée : un visage flou est rejeté avant comparaison, "
     "un visage jugé non vivant n'atteint jamais la galerie, et une identité doit être vue trois "
     "fois en cinq secondes avant d'atteindre la base."),
    ("04", "complément · module 2", "Séquence — ANPR", "sequence-anpr.svg", "04-sequence-anpr.puml",
     "Le module 2 a sa propre séquence parce que sa décision n'est pas la même : ici le résultat de "
     "l'IA est une chaîne de caractères, et c'est un <code>SELECT</code> qui décide de l'ouverture. "
     "La normalisation avant la requête est ce qui évite qu'un O lu pour un 0 refuse un bus autorisé."),
    ("05", "§ 8 · tiret 4", "Architecture / déploiement", "architecture.svg", "05-architecture.puml",
     "Quatre nœuds, quatre protocoles nommés. Un processus par caméra, un propriétaire unique de la "
     "base, et les empreintes biométriques stockées à part des identités — les trois décisions à "
     "défendre en soutenance."),
]


def load_svg(name: str) -> str:
    svg = (HERE / name).read_text()
    svg = re.sub(r'\s(?:width|height)="[0-9]+px"', "", svg, count=4)
    svg = re.sub(r'\sstyle="width:[^"]*"', "", svg, count=1)
    return svg.replace("<svg ", '<svg class="plate-svg" ', 1)


def main() -> None:
    sections = "".join(
        f"""
      <section class="plate" id="planche-{num}">
        <header class="plate-head">
          <p class="eyebrow"><span class="num">Planche {num}</span><span class="ref">{ref}</span></p>
          <h2>{title}</h2>
          <p class="note">{note}</p>
          <p class="src"><code>docs/uml/{source}</code></p>
        </header>
        <figure class="mount">
          <div class="frame" data-full="false">
            {load_svg(svg_file)}
          </div>
          <figcaption>
            <button type="button" class="zoom" aria-pressed="false">Taille réelle</button>
            <span class="hint">Le SVG reste net à n'importe quel zoom — c'est le format à coller dans le rapport.</span>
          </figcaption>
        </figure>
      </section>"""
        for num, ref, title, svg_file, source, note in PLATES
    )
    toc = "\n".join(
        f'<li><a href="#planche-{n}"><span class="tnum">{n}</span>'
        f'<span class="ttitle">{t}</span><span class="tref">{r}</span></a></li>'
        for n, r, t, _, _, _ in PLATES
    )
    shell = (HERE / "_shell.html").read_text()
    (HERE / "planches.html").write_text(f"""{shell}<div class="wrap">
  <header class="masthead">
    <p class="kicker">Projet de fin d'études · Section 8 du cahier des charges</p>
    <h1>Planches UML — système intelligent de détection par caméras IP</h1>
    <p class="standfirst">Cinq planches générées depuis des sources PlantUML versionnées, écrites à
      partir du code réel : noms de classes, seuils, points d'entrée de l'API. On modifie le texte,
      jamais l'image.</p>
  </header>

  <nav aria-label="Sommaire des planches">
    <ol class="toc">{toc}</ol>
  </nav>
  {sections}
  <footer>
    <p><strong>Régénérer :</strong> <code>java -jar plantuml.jar -tsvg -o . docs/uml/*.puml</code>
    puis <code>python3 docs/uml/build_planches.py</code>.</p>
  </footer>
</div>

<script>
  document.querySelectorAll(".zoom").forEach((button) => {{
    const frame = button.closest(".mount").querySelector(".frame");
    button.addEventListener("click", () => {{
      const full = frame.dataset.full !== "true";
      frame.dataset.full = String(full);
      button.setAttribute("aria-pressed", String(full));
      button.textContent = full ? "Ajuster à la largeur" : "Taille réelle";
    }});
  }});
</script>
""")
    print("planches.html:", (HERE / "planches.html").stat().st_size, "octets")


if __name__ == "__main__":
    main()
