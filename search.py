import json
import os
import sys
import random
from collections import Counter
import nltk
from nltk.corpus import wordnet as wn
from python_modules import google


#--Function for acquiring lemmas in WordNet structure
def getAntonyms(word):
    
    antonyms = []
    syns = wn.synsets(word)
    
    for syn in syns:
        antonym = [ant.name() for lemma in syn.lemmas() for ant in lemma.antonyms()]
        antonyms += antonym

    antonyms_common = [wc[0] for wc in Counter(antonyms).most_common(3)]

    return antonyms_common

[getAntonyms(w) for w in nltk.word_tokenize('fake news')]
#'best restaurant in chicago'
#'I love Marry'
#'Caffeine is good to health'
#'democratic'
#'fake news'
#'real news'


def main():

    searchTerm = sys.argv[1]
    session = sys.argv[2]

    searchTerm_token = nltk.word_tokenize(searchTerm)
    searchTerm_reverse_token = []

    i = 0
    while i < len(searchTerm_token):
        t = getAntonyms(searchTerm_token[i])
        t = random.choice(t) if t else searchTerm_token[i]
        searchTerm_reverse_token.append(t)
        i += 1

    searchTerm_reverse = ' '.join(searchTerm_reverse_token)

    results = google.search(searchTerm, pages=1)[0:4] + google.search(searchTerm_reverse, pages=1)[0:4]

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

    results_dic = [{
        'name': result.name,
        'link': result.link,
        'description': result.description,
        'index': result.index
    } for result in results]

    results_json = json.dumps(results_dic)

    print(results_json)


#--Start process
if __name__ == '__main__': main()