//#javascript
// abcemb-1.js file to include in html pages with abc2svg-1.js
//
// Copyright (C) 2014-2016 Jean-Francois Moine
// This program is free software; you can redistribute it and/or modify
// it under the terms of the GNU General Public License version 2 as
// published by the Free Software Foundation.");

var	errtxt = '',
	new_page = '',
	abc

// -- abc2svg init argument
var user = {
	read_file: function(fn) {	// include a file (%%abc-include)
		return readFile(fn)
	},
	errmsg: function(msg, l, c) {	// get the errors
		errtxt += msg + '\n'
	},
	img_out: function(str) {	// image output
		new_page += str
	},
	page_format: true		// define the non-page-breakable blocks
}

function debug() {
	var i, tmp ="debug:"
	for (i = 0; i < arguments.length; i++)
		tmp += " " + arguments[i];
//	alert(tmp)
	errtxt += tmp + '\n'
}

// function called when the page is loaded
function dom_loaded() {
	var page = document.body.innerHTML

	// search the ABC tunes and replace them by SVG images
	var	i = 0, j, k, res,
		re = /\n%abc|\nX:/g,
		re_stop = /\n<|\n%.begin/g
	abc = new Abc(user)
	for (;;) {

		// get the start of a ABC sequence
		res = re.exec(page)
		if (!res)
			break
		j = re.lastIndex - res[0].length;
		new_page += page.slice(i, j)

		// get the end of the ABC sequence
		// including the %%beginxxx/%%endxxx sequences
		re_stop.lastIndex = j
		while (1) {
			res = re_stop.exec(page)
			if (!res || res[0] == "\n<")
				break
			k = page.indexOf(res[0].replace("begin", "end"),
					re_stop.lastIndex)
			if (k < 0)
				break
			re_stop.lastIndex = k
		}
		if (!res || k < 0)
			k = page.length
		else
			k = re_stop.lastIndex - 2
		try {
			abc.tosvg('abcemb', page.slice(j + 1, k))
		} catch (e) {
			alert("abc2svg javascript error: " + e.message +
				"\nStack:\n" + e.stack)
		}
		if (errtxt) {
			i = page.indexOf("\n", j + 1);
			i = page.indexOf("\n", i + 1);
			alert("Errors in\n" +
				page.slice(j + 1, i) +
				"\n...\n\n" + errtxt);
			errtxt = ""
		}
		i = k
		if (k >= page.length)
			break
		re.lastIndex = i
	}
	try {
		document.body.innerHTML = new_page + page.slice(i)
	} catch (e) {
		alert("abc2svg bad generated SVG: " + e.message +
			"\nStack:\n" + e.stack)
	}
}

// wait for the page to be loaded
document.addEventListener("DOMContentLoaded", dom_loaded, false)
