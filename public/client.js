//--Loading spinner
//When submit form
document.getElementById("form").onsubmit = hideResult;

function hideResult() {
    //Disable input
    document.getElementById("btn-submit").setAttribute("disabled", "disabled");

    //Hide result
    var result = document.getElementsByClassName("result");
    for (var i = 0; i < result.length; i++) {
        result[i].classList.add("hide");
    }

    //Show spinner
    var loadSpinner = document.createElement("IMG");
    loadSpinner.src = "/image/loading-spinner.gif";
    loadSpinner.classList.add("loading-spinner");
    document.body.appendChild(loadSpinner);
}