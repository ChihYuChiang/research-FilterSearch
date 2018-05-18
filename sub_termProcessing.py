import sys
import random
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

[getAntonyms(w) for w in nltk.word_tokenize('good')]


#--Acquire the reverse terms based on the antonyms of each word
#Stopwords is not reversed
def getReverseTerms(searchTerm):

    searchTerm_token = nltk.word_tokenize(searchTerm)
    searchTerm_token_rs = [w if w not in stopwords.words('english') else '' for w in searchTerm_token]
    searchTerm_reverse_token = []

    i = 0
    while i < len(searchTerm_token_rs):
        t = getAntonyms(searchTerm_token_rs[i])
        t = random.choice(t) if t else searchTerm_token[i]
        searchTerm_reverse_token.append(t)
        i += 1

    searchTerm_reverse = ' '.join(searchTerm_reverse_token)

    return(searchTerm_reverse)

getReverseTerms('this is bad')


#--Main process
#Print in stdout to pass to parent program
def main():

    searchTerm = sys.argv[1]
    searchTerm_reverse = getReverseTerms(searchTerm)

    print(searchTerm_reverse)

if __name__ == '__main__': main()