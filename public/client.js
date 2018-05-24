

document.getElementById("form").onsubmit = hideResult;

function hideResult() {
    var result = document.getElementsByClassName("result")
    for (var i = 0; i < result.length; i++) {
        result[i].classList.add("hide");
    }
}