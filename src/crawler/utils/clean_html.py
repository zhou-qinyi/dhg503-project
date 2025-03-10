from lxml import etree
import re


def clean_html(
    html_page,
    xpath=None,
    remove_scripts=True,
    remove_styles=True,
    pretty=True,
    remove_whitespace=True,
):

    try:
        # Parse the HTML
        parser = etree.HTMLParser(remove_blank_text=True)
        original_tree = etree.HTML(html_page, parser)

        # Apply HTML cleaning operations
        remove_unwanted_elements(original_tree, remove_scripts, remove_styles)
        remove_event_handlers(original_tree)

        # Create new clean document
        new_doc = create_clean_document(original_tree, xpath)

        # Format and clean the document
        result = format_document(new_doc, pretty, remove_whitespace)

        return result

    except Exception as e:
        return html_page  # Return original if cleaning fails


def remove_unwanted_elements(tree, remove_scripts, remove_styles):
    """Remove script and style elements from the tree."""
    if remove_scripts:
        for script in tree.xpath("//script"):
            if script.getparent() is not None:
                script.getparent().remove(script)

    if remove_styles:
        for style in tree.xpath("//style"):
            if style.getparent() is not None:
                style.getparent().remove(style)

        # Also remove all link tags for CSS
        for link in tree.xpath("//link[@rel='stylesheet']"):
            if link.getparent() is not None:
                link.getparent().remove(link)


def remove_event_handlers(tree):
    """Remove all event handlers and inline scripts."""
    event_handlers = [
        "onclick",
        "onload",
        "onunload",
        "onchange",
        "onsubmit",
        "onfocus",
        "onblur",
    ]

    xpath_query = (
        "//*[" + " or ".join([f"@{handler}" for handler in event_handlers]) + "]"
    )
    for element in tree.xpath(xpath_query):
        for attr_name in event_handlers:
            if attr_name in element.attrib:
                del element.attrib[attr_name]


def create_clean_document(original_tree, xpath):
    """Create a new clean document with either the targeted element or body content."""
    new_doc = etree.Element("html")
    new_body = etree.SubElement(new_doc, "body")

    # Extract target element if xpath is provided
    if xpath:
        elements = original_tree.xpath(xpath)
        if elements and len(elements) > 0:
            target_element = elements[0]
            clean_text_nodes(target_element)
            new_body.append(target_element)
        else:
            # Return minimal HTML structure
            return new_doc
    else:
        # If no xpath or match, just use the body content
        body_elements = original_tree.xpath("//body/*")
        for element in body_elements:
            new_body.append(element)

    return new_doc


def clean_text_nodes(element, remove_whitespace=True):
    """Clean up text nodes in the target element."""
    for text_node in element.xpath(".//text()"):
        parent = text_node.getparent()
        if parent is not None:
            text = text_node.strip() if remove_whitespace else text_node
            if parent.text == text_node:
                parent.text = text
            else:
                for i, child in enumerate(parent):
                    if child.tail == text_node:
                        parent[i].tail = text
                        break


def format_document(doc, pretty, remove_whitespace):
    """Format and clean the document according to specified preferences."""
    doctype = "<!DOCTYPE html>"

    # Special handling for pretty printing
    if pretty:
        # First convert to string
        html_str = etree.tostring(doc, encoding="utf-8", pretty_print=True).decode(
            "utf-8"
        )
        # Replace XML self-closing tags with HTML tags
        html_str = re.sub(r"<([^>]+)/>", r"<\1></\1>", html_str)
        # Add doctype
        result = f"{doctype}\n{html_str}"
    else:
        # Minimal output without pretty printing
        html_str = etree.tostring(doc, encoding="utf-8", method="html").decode("utf-8")
        result = f"{doctype}{html_str}"

    # Apply whitespace cleanup if requested
    if remove_whitespace:
        result = clean_whitespace(result, pretty)

    return result


def clean_whitespace(html_str, pretty):
    """Remove excess whitespace from HTML string."""
    # Remove carriage returns
    html_str = html_str.replace("&#13;", "")
    # Remove excessive newlines
    html_str = re.sub(r"\n{2,}", "\n", html_str)
    # Remove spaces at the end of lines
    html_str = re.sub(r" +\n", "\n", html_str)

    if not pretty:
        # Additional cleanup for non-pretty mode
        html_str = re.sub(r">\s+<", "><", html_str)
        html_str = re.sub(r"\s{2,}", " ", html_str)

    return html_str
