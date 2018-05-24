

document.getElementById("form").onsubmit = hideResult;

function hideResult() {
    var result = document.getElementsByClassName("result");
    for (var i = 0; i < result.length; i++) {
        result[i].classList.add("hide");
    }

    var loadSpinner = document.createElement("IMG");
    loadSpinner.src = "/image/loading-spinner.gif";
    loadSpinner.classList.add("loading-spinner");
    document.body.appendChild(loadSpinner);
}