import json
from pathlib import Path
import re
import os
from urllib.parse import urlparse, parse_qs
import asyncio


def save_json(data, directory, source_name, filename=None):

    if filename is None:
        filename = f"{source_name}.json"
    file_path = Path(directory) / filename

    file_path.parent.mkdir(parents=True, exist_ok=True)

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)


def load_json(file_path):

    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_filepath(url, file_key, output_dir):

    parsed_url = urlparse(url)
    query_dict = parse_qs(parsed_url.query)

    if file_key not in query_dict:
        filename = re.sub(r"[^\w\-.]", "_", url)
        return os.path.join(output_dir, f"{filename}.html")

    file_name = query_dict[file_key][0]
    return os.path.join(output_dir, f"{file_name}.html")


async def save_html_async(html, url, file_key, output_dir):

    try:
        file_path = get_filepath(url, file_key, output_dir)
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        await asyncio.to_thread(write_file, file_path, html)
        return file_path

    except Exception as e:
        raise e


def write_file(file_path, content):
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)


def get_resumable_urls(target_urls, file_key, output_dir):
    return [
        url
        for url in target_urls
        if not os.path.exists(get_filepath(url, file_key, output_dir))
    ]
