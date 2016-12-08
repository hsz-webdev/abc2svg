// abc2svg - pstail.js
// Copyright (C) 2014-2015 Jean-Francois Moine
// This program is free software; you can redistribute it and/or modify
// it under the terms of the GNU General Public License version 2 as
// published by the Free Software Foundation.

// end of the Abc object
// ps functions

// ---- functions to call the PS interpreter
// try to generate a decoration by PS
function psdeco(f, x, y, de) {
	var	dd, de2, script, defl,
		Os = wpsobj.parse('/' + f + ' where'),
		A = Os.pop()
	if (!A)
		return false
	Os.pop();
	defl = 0
	if (de.defl.nost)
		defl = 1
	if (de.defl.noen)
		defl |= 2
	if (de.s.stem >= 0)
		defl |= 4

	script = '/defl ' + defl + ' def '
	if (de.lden) {
		script += x.toFixed(2) + ' ' + y.toFixed(2) + ' '
		de2 = de.start;
//		if (de2) {
			x = de2.x;
			y = de2.y + staff_tb[de2.st].y
//		} else {
//fixme: should emit a warning
//			x -= 30
//		}
		if (x > de.x - 20)
			x = de.x - 20
	}
	dd = de.dd
	if (de.has_val) {
		script += de.val + ' '
	} else if (dd.str) {
		script += '(' + dd.str + ') ';
		y += dd.h * 0.2
	}
	script += x.toFixed(2) + ' ' + y.toFixed(2) + ' ' + f;
	svgobj.setorig(posx, posy);
	wpsobj.parse(script);
	svgobj.setg(1);
	output.push(svgbuf);
	svgbuf = ''
	return true
}

// try to generate a head decoration by PS
function pshdeco(f, x, y, dd) {
	var	script,
		Os = wpsobj.parse('/' + f + ' where'),
		A = Os.pop()
	if (!A)
		return false
	Os.pop();
	script = ''
	if (dd.str)
		script += '(' + dd.str + ') ';
	script += x.toFixed(2) + ' ' + y.toFixed(2) + ' ' + f;
	svgobj.setorig(posx, posy);
	wpsobj.parse(script);
	svgobj.setg(1);
	output.push(svgbuf);
	svgbuf = ''
	return true
}

// try to generate a glyph by PS
function psxygl(x, y, gl){
	var	Os = wpsobj.parse('/' + gl + ' where'),
		A = Os.pop()
	if (!A) {
		wpsobj.parse('dlw');
		svgobj.g_upd();
		output.push(svgbuf);
		svgbuf = ''
		return false
	}
	Os.pop();
	svgobj.setorig(posx, posy);
	wpsobj.parse('dlw ' + x.toFixed(2) + ' ' + y.toFixed(2) + ' ' + gl);
	svgobj.setg(1);
	output.push(svgbuf);
	svgbuf = ''
	return true
}

// ---- functions called from the PS interpreter
function psxy() {
	var xy = svgobj.getorig()
	if (svgbuf) {
		output.push(svgbuf);
		svgbuf = ''
	}
	return xy
}

// output an arpeggio
this.arpps = function(val, x, y) {
	var xy = psxy();
	out_arp(x + xy[0], y - xy[1], val)
}

// output a deco with string
this.xyglsps = function(str, x, y, gl) {
	var xy = psxy();
	out_deco_str(x + xy[0], y - xy[1], gl, str)
}

// output a deco with value
this.xyglvps = function(val, x, y, gl) {
	var xy = psxy();
	out_deco_val(x + xy[0], y - xy[1], gl, val)
}

// output a glyph
this.xyglps = function(x, y, gl) {
	var xy = psxy();
	x += xy[0];
	y -= xy[1];
	def_use(gl);
	output.push('<use x="');
	out_sxsy(x, '" y="', y);
	output.push('" xlink:href="#' + gl + '"/>\n')
}
this.get_y = function(st, y) {
	return y + staff_tb[st].y
}

// initialize
	abc2svg_init();
	svgobj = new Svg;
	wpsobj = new Wps;
	abcobj = this;
	wpsobj.parse(psvg_op,
"/!{bind def}bind def\n\
/T/translate load def\n\
/M/moveto load def\n\
/RM/rmoveto load def\n\
/L/lineto load def\n\
/RL/rlineto load def\n\
/C/curveto load def\n\
/RC/rcurveto load def\n\
/SLW/setlinewidth load def\n\
/defl 0 def\n\
/dlw{0.7 SLW}!\n\
/xymove{/x 2 index def/y 1 index def M}!\n\
/showc{dup stringwidth pop .5 mul neg 0 RM show}!\n\
%\n\
% abcm2ps internal glyphs\n\
%/arp{.svg(arp)3 .call0}.bdef\n\
/ft0{(acc-1).svg(xygl)3 .call0}.bdef\n\
/nt0{(acc3).svg(xygl)3 .call0}.bdef\n\
/sh0{(acc1).svg(xygl)3 .call0}.bdef\n\
/dsh0{(acc2).svg(xygl)3 .call0}.bdef\n\
%/trl{(trl).svg(xygl)3 .call0}.bdef\n\
/y0{.svg(y0)1 .call}.bdef\n\
/y1{.svg(y1)1 .call}.bdef\n")

	return this
}	// end of Abc()
