import json
import os
import sys
import random
from collections import Counter
from python_modules import google
from sub_termProcessing import getReverseTerms


def main():

    #Accept search term from comment line argument
    searchTerm = sys.argv[1]

    #Perform google scrape search
    results = google.search(searchTerm, pages=1)

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

    #Parse the result into a dic with expected data structure
    results_dic = {
        'items': [{
            'title': result.name,
            'link': result.link,
            'snippet': result.description,
            'index': result.index
        } for result in results]
    }

    #Parse the dic into json and print in stdout
    results_json = json.dumps(results_dic)
    print(results_json)


#--Start process
if __name__ == '__main__': main()