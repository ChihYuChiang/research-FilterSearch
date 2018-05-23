import sys
import random
import numpy as np
from collections import Counter
import nltk
from nltk.corpus import wordnet as wn
from nltk.corpus import stopwords


#--Acquire lemmas and antonyms of one word in WordNet structure
def getAntonyms(word):
    
    antonyms = []
    syns = wn.synsets(word)
    
    for syn in syns:
        antonym = [ant.name() for lemma in syn.lemmas() for ant in lemma.antonyms()]
        antonyms += antonym

    antonyms_common = [wc[0] for wc in Counter(antonyms).most_common(3)]

    return antonyms_common

#Sample
[getAntonyms(w) for w in nltk.word_tokenize('good')]


#--Acquire the reverse terms based on the antonyms of each word
#Stopwords is not reversed
#mode = 'short' or 'rand' => shortest word or random antonym of a word
def getReverseTerms(searchTerm, mode='short'):

    searchTerm_token = nltk.word_tokenize(searchTerm)
    searchTerm_reverse = []

    for idx, w in enumerate(searchTerm_token):
        if w in stopwords.words('english'): continue

        rw = getAntonyms(w)
        if len(rw) == 0: continue

        if mode == 'short':
            t_id = np.argmin([len(tk) for tk in rw]) + 1
            t = rw[t_id - 1]

        if mode == 'rand': t = random.choice(rw)

        searchTerm_reverse_token = searchTerm_token.copy()
        searchTerm_reverse_token[idx] = t
        searchTerm_reverse.append(' '.join(searchTerm_reverse_token))

    return(searchTerm_reverse)

#Sample
getReverseTerms('this is girl')
getReverseTerms('caffeine is good to health')


#--Acquire reverse terms of a file input
def getReverseTerms_file(filePath):

    processing = []

    #Read each word and get antonym
    with open(filePath) as f:
        for line in f:
            processing.append(', '.join([line.strip()] + getAntonyms(line.strip())))

    #Write back to file
    with open('data/out.csv', 'w+') as f:
        for line in processing:
            f.write(line)
            f.write('\n')

#Sample
getReverseTerms_file('data/Keywords.csv')


#--Main process
#Print in stdout to pass to parent program
def main():

    searchTerm = sys.argv[1]
    searchTerm_reverse = getReverseTerms(searchTerm)

    for term in searchTerm_reverse: print(term)

if __name__ == '__main__': main()