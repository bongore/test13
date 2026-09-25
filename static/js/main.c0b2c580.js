(function(){
  var script = document.createElement("script");
  script.src = "/test13/static/js/main.62c3a81f.js";
  script.defer = true;
  script.onerror = function(){
    var route = window.location.pathname;
    if ("/test13" && route.indexOf("/test13") === 0) {
      route = route.slice("/test13".length) || "/";
    }
    window.location.replace("/test13/" + "?redirect=" + encodeURIComponent(route + window.location.search + window.location.hash) + "&v=" + Date.now());
  };
  document.head.appendChild(script);
}());
