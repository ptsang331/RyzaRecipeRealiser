import database.scripts.RyzaRecipeRealiser as RyzaRecipeRealiser
import ItemRecipe
import ItemIDEnumDict
import StringIDToLang
from dotenv import load_dotenv
import os

if __name__ == "__main__":
    load_dotenv()

    recipeRealiser = RyzaRecipeRealiser.RyzaRecipeRealiser( os.getenv("NEO4J_URI"), os.getenv("NEO4J_USERNAME"), os.getenv("NEO4J_PASSWORD"))


    itemRecipePath = os.getenv("ITEM_RECIPE_PATH")
    mixFieldPath = os.getenv("MIX_FIELD_PATH")
    itemCategoriesIDPath = os.getenv("ITEM_CATEGORIES_ID_PATH")
    dictPath = os.getenv("DICT_PATH")

    itemRecipes = ItemRecipe.createItemRecipe(itemRecipePath, mixFieldPath, itemCategoriesIDPath)
    itemEnumDict = ItemIDEnumDict.createItemIDEnumDict(dictPath)

    recipeRealiser.createDB(itemRecipes, itemEnumDict)

    allStringPath = "../data/strcombineall.xml"

    stringIDToLang = StringIDToLang.createStringIDToLang(allStringPath)
    recipeRealiser.applyTranslation(stringIDToLang, "en")

    recipeRealiser.connectForFrontEnd()
