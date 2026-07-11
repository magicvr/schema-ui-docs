import math
from decimal import Decimal


UNRESERVED = frozenset(b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~")


def failure(code):
    return {"ok": False, "code": code}


def is_valid_unicode_scalar_string(value):
    if not isinstance(value, str):
        return False
    return all(not 0xD800 <= ord(character) <= 0xDFFF for character in value)


def percent_encode(value):
    output = []
    for byte in value.encode("utf-8"):
        output.append(chr(byte) if byte in UNRESERVED else f"%{byte:02X}")
    return "".join(output)


def decode_base_query_component(value):
    output = bytearray()
    index = 0
    try:
        while index < len(value):
            if value[index] == "%":
                if index + 2 >= len(value):
                    return None
                output.append(int(value[index + 1:index + 3], 16))
                index += 3
            else:
                output.extend(value[index].encode("utf-8"))
                index += 1
        decoded = output.decode("utf-8", errors="strict")
        return decoded if is_valid_unicode_scalar_string(decoded) else None
    except (UnicodeError, ValueError):
        return None


def jcs_number(value):
    number = float(value)
    if not math.isfinite(number):
        return None
    if number == 0:
        return "0"

    shortest = repr(number).lower()
    absolute = abs(number)
    if 1e-6 <= absolute < 1e21:
        fixed = format(Decimal(shortest), "f")
        if "." in fixed:
            fixed = fixed.rstrip("0").rstrip(".")
        return fixed

    mantissa, exponent = shortest.split("e")
    if mantissa.endswith(".0"):
        mantissa = mantissa[:-2]
    exponent_value = int(exponent)
    exponent_text = f"+{exponent_value}" if exponent_value >= 0 else str(exponent_value)
    return f"{mantissa}e{exponent_text}"


def scalar_to_text(value):
    if value is None:
        return {"tombstone": True}
    if isinstance(value, str):
        return {"text": value} if is_valid_unicode_scalar_string(value) else None
    if isinstance(value, bool):
        return {"text": "true" if value else "false"}
    if isinstance(value, (int, float)):
        text = jcs_number(value)
        return {"text": text} if text is not None else None
    return None


def serialize_query(base_url, sources):
    if not isinstance(base_url, str) or not isinstance(sources, list):
        return failure("INVALID_QUERY_INPUT")

    fragment_index = base_url.find("#")
    request_part = base_url if fragment_index == -1 else base_url[:fragment_index]
    fragment = "" if fragment_index == -1 else base_url[fragment_index:]
    query_index = request_part.find("?")
    path = request_part if query_index == -1 else request_part[:query_index]
    base_query = "" if query_index == -1 else request_part[query_index + 1:]
    merged = {}

    for segment in base_query.split("&"):
        if segment == "":
            continue
        encoded_key, separator, encoded_value = segment.partition("=")
        if separator == "":
            encoded_value = ""
        key = decode_base_query_component(encoded_key)
        value = decode_base_query_component(encoded_value)
        if key is None or value is None:
            return failure("INVALID_BASE_URL_QUERY")
        if key == "":
            return failure("INVALID_QUERY_KEY")
        merged[key] = value

    for source in sources:
        if not isinstance(source, list):
            return failure("INVALID_QUERY_INPUT")
        for entry in source:
            if not isinstance(entry, list) or len(entry) != 2:
                return failure("INVALID_QUERY_INPUT")
            key, value = entry
            if not is_valid_unicode_scalar_string(key) or key == "":
                return failure("INVALID_QUERY_KEY")
            scalar = scalar_to_text(value)
            if scalar is None:
                return failure("INVALID_QUERY_VALUE")
            if scalar.get("tombstone"):
                merged.pop(key, None)
            else:
                merged[key] = scalar["text"]

    query = "&".join(
        f"{percent_encode(key)}={percent_encode(merged[key])}"
        for key in sorted(merged, key=lambda item: tuple(ord(character) for character in item))
    )
    return {"ok": True, "url": f"{path}{'' if query == '' else '?' + query}{fragment}"}