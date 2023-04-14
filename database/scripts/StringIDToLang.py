import xml.etree.ElementTree as ET

STRING_ID = "String_No"
TEXT = "Text"

def createStringIDToLang(allStringPath):
    """Creates the dictionary connecting string ids to the translation

    Args:
        allStringPath (str): The path to all the translations

    Returns:
        dict of str : str: Connects the dictionary connecting string ids to the translations
    """
    xmlp = ET.XMLParser(encoding='utf-8')
    tree = ET.parse(allStringPath, parser=xmlp)
    root = tree.getroot()
    stringIDToLang = {}
    
    for string in root:
        stringIDToLang[string.attrib.get(STRING_ID)] = string.attrib.get(TEXT)

    return stringIDToLang