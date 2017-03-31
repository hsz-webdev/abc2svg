// abc2svg - cmdline.js - command line
//
// Copyright (C) 2014-2016 Jean-Francois Moine
// This program is free software; you can redistribute it and/or modify
// it under the terms of the GNU General Public License version 2 as
// published by the Free Software Foundation.");

// global variables
var abc, errtxt = ''

// -- replace the exotic end of lines by standard ones
function set_eoln(file) {
	var i = file.indexOf('\r')
	if (i < 0)
		return undefined	// standard
	if (file[i + 1] == '\n')
		return file.replace(/\r\n/g, '\n')	// M$
	return file.replace(/\r/g, '\n')		// Mac
}

// -- abc2svg init argument
var user = {
	read_file: function(fn) {	// include a file (%%abc-include)
		var	file = readFile(fn),
			file2 = set_eoln(file)
		return file2 || file
	},
	errmsg: function(msg, l, c) {	// get the errors
		errtxt += msg + '\n'
	},
}

//test
function dump_obj(obj) {
	print("<!-- dump")
	if (obj && typeof(obj) == 'object') {
		for (var k in obj)
			print("  " + k + ": " + obj[k])
	} else {
		print(" not an object:", obj)
	}
	print(" -->")
}

function do_file(fname) {
	var i, j, file, file2;
	j = fname.lastIndexOf("/")
	if (j < 0)
		j = 0;
	i = fname.indexOf(".", j)
	if (i < 0)
		fname += ".abc";
	file = readFile(fname)
	if (!file)
		abort(new Error("Cannot read file '" + fname + "'"));
	file2 = set_eoln(file)
	if (file2)
		file = file2
//	if (typeof(utf_convert) == "function")
//		file = utf_convert(file);
	try {
		abc.tosvg(fname, file)
	}
	catch (e) {
		abort(e)
	}
}

function abc_cmd(cmd, args) {
	var arg, param, fname;

	abc = new Abc(user);
	abc_init(abc)
	while (1) {
		arg = args.shift()
		if (!arg)
			break
		if (arg[0] == "-") {
			if (arg[1] == "-") {
				param = args.shift();
				abc.tosvg(cmd, arg.replace('--', '%%') +
						" " + param + "\n")
			}
		} else {
			if (fname) {
				do_file(fname);
				abc.tosvg('cmd', '%%select\n')
			}
			fname = arg
		}
	}
	if (fname)
		do_file(fname);

	abc_end(abc)
}
