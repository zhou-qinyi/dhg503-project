from urllib.parse import urlencode, urlparse, parse_qs


def construct_url(url, params=None):
    parsed_url = urlparse(url)
    query_params = parse_qs(parsed_url.query)

    if params:
        for key, value in params.items():
            query_params[key] = [value]

    encoded_query = urlencode(query_params, doseq=True)

    result = f"{parsed_url.scheme}://{parsed_url.netloc}{parsed_url.path}"
    if encoded_query:
        result += f"?{encoded_query}"
    if parsed_url.fragment:
        result += f"#{parsed_url.fragment}"
    return result


def get_clean_url(url):
    """Convert URL to a clean format for display and storage."""
    parsed_url = urlparse(url)
    scheme = parsed_url.scheme
    hostname = parsed_url.netloc
    path = parsed_url.path
    params = parsed_url.query

    # Create a safe filename with first query parameter
    safe_name = f"{scheme}://{hostname}{path}"
    if params:
        safe_name += f"?{params.split('&')[0]}"

    return safe_name
