//--Loading spinner
//When submit form
document.getElementById("form").onsubmit = hideResult;

function hideResult() {
    //Disable input
    document.getElementById("btn-submit").setAttribute("disabled", "disabled");

    //Hide result
    var result = document.getElementsByClassName("result");
    for(var i = 0; i < result.length; i++) {
        result[i].classList.add("hide");
    }

    //Show spinner
    var loadSpinner = document.createElement("IMG");
    loadSpinner.src = "/image/loading-spinner.gif";
    loadSpinner.classList.add("loading-spinner");
    document.body.appendChild(loadSpinner);
}


//--Send window unload event
//'/:responseId/unload'
$(window).on("beforeunload", () => {
    $.ajax({ url: "/unload/" + $("#responseId").attr("value"), type: "GET", cache: false })
});


//--Restrict mouse right click
//So the mouse click tracker works better
$(document).ready(() => {
    $("*").on("contextmenu", () => { return false; });
});


//--Send link clicked event
//'link-clicked/:responseId/:idx'
var result = document.getElementsByClassName("result-title");
for(var i = 0; i < result.length; i++) {
    result[i].onclick = function() {
        var origin = this.childNodes[3].getAttribute("value") == "/" ? "so" : this.childNodes[3].getAttribute("value");
        var url = "/link-clicked/" + $("#responseId").attr("value") + "/" + this.childNodes[1].getAttribute("value") + "/" + origin;
        console.log(url);
        $.ajax({ url: url, type: "GET", cache: false });
    }
}