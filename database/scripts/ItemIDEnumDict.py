import csv

class ItemIDEnumDict:
    def __init__(self):
        self.enumToID = {}
        self.englishToID = {}
        self.addCat = {}
        #Manually added since it is easier for 4 elements
        self.addElem = {
            "ITEM_EFF_CREATE_MATERIAL_BOOST_07" : "4063340",
            "ITEM_EFF_CREATE_MATERIAL_BOOST_08" : "4063341",
            "ITEM_EFF_CREATE_MATERIAL_BOOST_09" : "4063342",
            "ITEM_EFF_CREATE_MATERIAL_BOOST_10" : "4063343"
        }

def createItemIDEnumDict(dictPath):
    """Creates the different dictionaries used to match values to another

    Args:
        dictPath (str): the path to the file containing string ids, English name and enum

    Returns:
        ItemIDEnumDict: the dictionaries used
    """
    itemIDEnumDict = ItemIDEnumDict()
    with open(dictPath) as dictFile:
        dictCSV = csv.reader(dictFile)
        for row in dictCSV:
            itemIDEnumDict.englishToID[row[1].encode("ascii", errors="ignore").decode()] = row[2]
            itemIDEnumDict.enumToID[row[0]] = row[2]

            if row[0].startswith("ITEM_EFF_ADD_CATEGORY"):
                #easiest way for me to connect the add categories to the string id of what they add
                itemIDEnumDict.addCat[row[0]] = itemIDEnumDict.englishToID[row[1][len("Add "):]] 

    return itemIDEnumDict
