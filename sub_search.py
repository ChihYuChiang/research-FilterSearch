import json
import os
import sys
import random
from collections import Counter
import nltk
from nltk.corpus import wordnet as wn
from python_modules import google
from sub_termProcessing import getReverseTerms


def main():

    searchTerm = sys.argv[1]
    searchTerm_reverse = getReverseTerms(searchTerm)

    results = google.search(searchTerm, pages=1)[0:5] + google.search(searchTerm_reverse, pages=1)[0:5] if searchTerm != searchTerm_reverse else google.search(searchTerm, pages=2)[0:10]

    '''
    GoogleResult:
        self.name #The title of the link
        self.link #The external link
        self.google_link #The google link
        self.description #The description of the link
        self.cached #A link to the cached version of the page
        self.page #What page this result was on (When searching more than one page)
        self.index #What index on this page it was on
        self.number_of_results #The total number of results the query returned
    '''

    results_dic = {
        'searchTerms': [searchTerm, searchTerm_reverse],
        'items': [{
            'name': result.name,
            'link': result.link,
            'description': result.description,
            'index': result.index
        } for result in results]
    }

    results_json = json.dumps(results_dic)

    print(results_json)


#--Start process
if __name__ == '__main__': main()