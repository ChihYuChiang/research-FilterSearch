from google import google
import json
import os

results = google.search("This is my query", pages=1)

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

with open(r'temp\results.json', 'w') as f:
    f.write(results_json)
