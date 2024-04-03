#!/usr/bin/python

import sys
import re

from os import listdir, mkdir, makedirs
from os.path import isdir, isfile, join, exists
from shutil import copyfile, copytree, rmtree
from pprint import pprint

imports = []

def modifyMetadata():
    o = open("./dist/metadata.json", "w")
    for l in open("./metadata.json", "r"):
        if '"45"' in l:
            l = '"42", "43", "44"\n'
        o.write(l)

def dump(f):
    if "imports_" in f:
        return
    if "tests/" in f:
        return
    if "dist/" in f:
        return
    if "build/" in f:
        return
    if not buildPrefs and "prefs.js" in f:
        return
    f = f.strip()
    if not f.endswith(".js"):
        return
    output.write("//-----------------------------\n")
    output.write("// " + f + "\n")
    output.write("//-----------------------------\n\n")

    inImport = False;
    for l in open(f, "r"):
        commentOut = False


        if l.startswith("'use strict'") or l.startswith("const Point"):
            commentOut = True
        if "getSettings" in l:
            l = l.replace("this.getSettings", "ExtensionUtils.getSettings");
        if l.startswith("import "):
            commentOut = True
            inImport = True

        if buildPrefs:
            if "ExtensionPreferences" in l:
                l = l.replace("extends ExtensionPreferences", "")
            if "super(metadata);" in l:
                l = l.replace("super(metadata);", "")
            # if "/ui`;" in l:
            #     l = l.replace("/ui`;", "/ui/legacy`;")

        if l.startswith("export default"):
            l = l.replace("export default", "")
        if l.startswith("export "):
            l = l.replace("export ", "")

        if commentOut or inImport:
            output.write("//")
        output.write(l);

        if inImport and "from" in l:
            inImport = False

    output.write("\n\n")


def dumpFiles(path):
    morePaths = []

    files = listdir(path)
    for f in files:
        fullpath = join(path, f)

        if isdir(fullpath):
            morePaths.append(fullpath)
            continue

        dump(fullpath)

    for p in morePaths:
        dumpFiles(p)

def dumpPref(path):
    dump(join(path, "prefs.js"))
    dumpFiles(join(path, "preferences"))

buildPrefs = False
output = open("./dist/extension.js", "w")
output.write(open("./imports_legacy.js", "r").read())
output.write("\n\n")

dumpFiles("./")
buildPrefs = True
output = open("./dist/prefs.js", "w")
output.write(open("./imports_prefs.js", "r").read())
output.write("\n\n")

dumpPref("./")

modifyMetadata()
