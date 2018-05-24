import sys
import codecs
import random
import numpy as np
from collections import Counter
import nltk
from nltk.corpus import wordnet as wn
from nltk.corpus import stopwords

#Read common word list
#Source: http://www.wordfrequency.info
COMMON_WORDS = []
with codecs.open('data/commonWords.txt', 'r', 'UTF-8') as f:
    f.readline() #Skip the first line

    for line in f:
        COMMON_WORDS.append(line.strip())

COMMON_WORDS_N = len(COMMON_WORDS)


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
        #Do not reverse stop words
        if w in stopwords.words('english'): continue

        #Get antonyms
        rw = getAntonyms(w)
        
        #If no antonym, continue
        if len(rw) == 0: continue

        #Select the antonym if it is in the most common list; if multiple in the list, select the most common one
        tk_cid = []
        for tk in rw:
            try: tk_cid.append(COMMON_WORDS_N - COMMON_WORDS.index(tk))
            except: tk_cid.append(0)
        if sum(tk_cid) > 0: t = COMMON_WORDS[-(max(tk_cid) - COMMON_WORDS_N)]

        #If no one is in the most common list, select based on the mode
        else:
            if mode == 'short':
                t_id = np.argmin([len(tk) for tk in rw]) + 1
                t = rw[t_id - 1]

            if mode == 'rand': t = random.choice(rw)
        
        #Recreate the term and add into the searchTerm list
        searchTerm_reverse_token = searchTerm_token.copy()
        searchTerm_reverse_token[idx] = t
        searchTerm_reverse.append(' '.join(searchTerm_reverse_token))

    return(searchTerm_reverse)

#Sample
getReverseTerms('this is girl')
getReverseTerms('caffeine is good to health')
getReverseTerms('successful reverse project') #Reverse not in the list


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