#!/usr/bin/env python3
"""Sync missing MP3 files from theme JavaScript files.

What it does:
1) Reads all files in themes/*.js (except init.js)
2) Extracts words from string literals in those files
3) Compares against audios/<word>.mp3
4) Prints missing words
5) Optionally generates missing MP3 files via gTTS

Usage:
  python3 scripts/sync_missing_audios.py --dry-run
  python3 scripts/sync_missing_audios.py
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


def normalize_word(raw: str) -> str:
    return re.sub(r"[^a-z]", "", raw.strip().lower().removesuffix(".mp3"))


def extract_words_from_theme_js(file_path: Path) -> list[str]:
    text = file_path.read_text(encoding="utf-8")
    literals = re.findall(r'"([^"\\]*(?:\\.[^"\\]*)*)"', text)
    words: list[str] = []
    for lit in literals:
        word = normalize_word(lit)
        if len(word) >= 2:
            words.append(word)
    return words


def collect_theme_words(themes_dir: Path) -> list[str]:
    words: list[str] = []
    js_files = sorted(
        p for p in themes_dir.glob("*.js") if p.is_file() and p.name != "init.js"
    )

    if not js_files:
        raise FileNotFoundError("Nenhum arquivo de tema encontrado em themes/*.js")

    for js_file in js_files:
        words.extend(extract_words_from_theme_js(js_file))

    # Keep insertion order and remove duplicates.
    unique_words = list(dict.fromkeys(words))
    return unique_words


def find_missing(words: list[str], audios_dir: Path) -> list[str]:
    missing: list[str] = []
    for word in words:
        if not (audios_dir / f"{word}.mp3").exists():
            missing.append(word)
    return missing


def generate_with_gtts(words: list[str], audios_dir: Path, lang: str) -> tuple[list[str], list[str]]:
    try:
        from gtts import gTTS
    except ImportError as exc:
        raise RuntimeError(
            "gTTS nao esta instalado. Rode: pip install gtts"
        ) from exc

    created: list[str] = []
    failed: list[str] = []

    for word in words:
        out_path = audios_dir / f"{word}.mp3"
        try:
            tts = gTTS(text=word, lang=lang, slow=False)
            tts.save(str(out_path))
            created.append(word)
            print(f"[OK] {word}")
        except Exception:
            failed.append(word)
            print(f"[FAIL] {word}")

    return created, failed


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Lista e gera MP3s faltantes com base nos temas JS"
    )
    parser.add_argument(
        "--themes-dir",
        default="themes",
        help="Diretorio com os arquivos de tema .js (padrao: themes)",
    )
    parser.add_argument(
        "--audios-dir",
        default="audios",
        help="Diretorio de saida/checagem dos .mp3 (padrao: audios)",
    )
    parser.add_argument(
        "--lang",
        default="en",
        help="Idioma do gTTS (padrao: en)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Somente lista palavras faltantes, sem gerar MP3",
    )
    args = parser.parse_args()

    root = Path.cwd()
    themes_dir = root / args.themes_dir
    audios_dir = root / args.audios_dir

    if not themes_dir.exists():
        print(f"Erro: diretorio de temas nao existe: {themes_dir}")
        return 1

    audios_dir.mkdir(parents=True, exist_ok=True)

    try:
        words = collect_theme_words(themes_dir)
    except FileNotFoundError as exc:
        print(f"Erro: {exc}")
        return 1

    missing = find_missing(words, audios_dir)

    print(f"Total de palavras nos temas: {len(words)}")
    print(f"Total de MP3 faltantes: {len(missing)}")

    if missing:
        print("Palavras faltantes:")
        for word in missing:
            print(f"- {word}")
    else:
        print("Nenhuma palavra faltante.")

    if args.dry_run or not missing:
        return 0

    created, failed = generate_with_gtts(missing, audios_dir, args.lang)
    print("\nResumo da geracao:")
    print(f"Criados: {len(created)}")
    print(f"Falharam: {len(failed)}")

    if failed:
        print("Falhas:")
        for word in failed:
            print(f"- {word}")
        return 2

    return 0


if __name__ == "__main__":
    sys.exit(main())
