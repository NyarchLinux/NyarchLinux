import xml.etree.ElementTree as ET
import xml.dom.minidom as DOM

def _createElement(dom, name, attributes, text):
    prop = dom.createElement(name)
    if not attributes is None:
        for attr in attributes:
            for k in attr.keys():
                if attr[k] != '':
                    prop.setAttribute(k, attr[k])
    if not text is None:
        prop.appendChild(dom.createTextNode(text));
    return prop

def _toDomElement(dom, source):
    obj = dom.createElement(source.tag)

    # copy text
    if source.text and source.text.strip() != '':
        obj.appendChild(dom.createTextNode(source.text))
        # print(source.text)

    # copy attributes
    for k in source.attrib.keys():
        obj.setAttribute(k, source.attrib[k])

    # copy children
    for child in source:
        obj.appendChild(_toDomElement(dom, child))

    return obj

def parseXML(source_file, target_file):
    doc = DOM.Document()
    interface = doc.createElement('interface') 
    doc.appendChild(interface)

    # create element tree object
    tree = ET.parse(source_file)

    # get root element
    root = tree.getroot()

    prefPage = [ root.find('object[@class="AdwPreferencesPage"]') ]

    for item in prefPage:
        name = item.find('property[@name="name"]')
        title = item.find('property[@name="title"]')

        page = _createElement(doc, 'object', [{'class': 'GtkBox', 'id': name.text}], None)
        page.appendChild(_createElement(doc, 'property', [{'name':'visible'}], 'True'))
        page.appendChild(_createElement(doc, 'property', [{'name': 'can-focus'}], 'False'))
        page.appendChild(_createElement(doc, 'property', [{'name': 'margin-start'}], '12'))
        page.appendChild(_createElement(doc, 'property', [{'name': 'margin-end'}], '12'))
        page.appendChild(_createElement(doc, 'property', [{'name': 'margin-top'}], '12'))
        page.appendChild(_createElement(doc, 'property', [{'name': 'margin-bottom'}], '12'))
        page.appendChild(_createElement(doc, 'property', [{'name': 'orientation'}], 'vertical'))

        interface.appendChild(page)

        child = doc.createElement('child')
        listBox = _createElement(doc, 'object', [{'class': 'GtkListBox'}], None)
        child.appendChild(listBox)
        page.appendChild(child)

        # groups
        for ch in item.findall('child'):

            group = ch.find('object[@class="AdwPreferencesGroup"]')
            groupTitle = group.find('property[@name="title"]')
            groupDescription = group.find('property[@name="description"]')

            ######################

            # listBoxChild = doc.createElement('child')
            # listBoxRow = _createElement(doc, 'object', [{'class': 'GtkListBoxRow'}], None)
            # listBoxRow.appendChild(_createElement(doc, 'property', [{'name':'visible'}], 'True'))
            # listBoxRow.appendChild(_createElement(doc, 'property', [{'name':'can-focus'}], 'True'))
            # listBoxChild.appendChild(listBoxRow)
            # listBox.appendChild(listBoxChild)

            # row_template = ET.parse("./tests/legacy_row_template.ui").getroot().find('child')

            # label = row_template.find('object/child/object/child/object[@class="GtkLabel"]/property[@name="label"]')
            # label.text = groupTitle.text

            # description = row_template.find('object/child/object[@class="GtkLabel"]/property[@name="label"]')
            # description.text = groupDescription.text;

            # box = row_template.find('object/child[1]/object')
            # control = row_template.find('object/child[1]/object/child[2]')
            # box.remove(control)

            # row = _toDomElement(doc, row_template)
            # listBoxRow.appendChild(row)

            # groupChild = doc.createElement('child')
            # groupBox = _createElement(doc, 'object', [{'class': 'GtkListBox'}], None)
            # groupChild.appendChild(groupBox)
            # listBox.appendChild(groupChild)

            ######################
            
            groupBox = listBox

            for actionRow in group.findall('child/object[@class="AdwActionRow"]'):
                actionTitle = actionRow.find('property[@name="title"]')
                actionSubTitle = actionRow.find('property[@name="subtitle"]')
                actionControl = actionRow.find('child')
                visible = actionRow.find('property[@name="visible"]')

                if not visible is None and visible.text == 'false':
                    continue
                
                # print(actionTitle.text)

                listBoxChild = doc.createElement('child')
                listBoxRow = _createElement(doc, 'object', [{'class': 'GtkListBoxRow'}], None)
                listBoxRow.appendChild(_createElement(doc, 'property', [{'name':'visible'}], 'True'))
                listBoxRow.appendChild(_createElement(doc, 'property', [{'name':'can-focus'}], 'True'))
                listBoxChild.appendChild(listBoxRow)
                groupBox.appendChild(listBoxChild)

                row_template = ET.parse("./tests/legacy_row_template.ui").getroot().find('child')

                label = row_template.find('object/child/object/child/object[@class="GtkLabel"]/property[@name="label"]')
                label.text = actionTitle.text

                description = row_template.find('object/child/object[@class="GtkLabel"]/property[@name="label"]')
                description.text = actionSubTitle.text

                box = row_template.find('object/child[1]/object')
                control = row_template.find('object/child[1]/object/child[2]')
                box.remove(control)

                row = _toDomElement(doc, row_template)
                _box = row.getElementsByTagName('object')[1]
                _box.appendChild(_toDomElement(doc, actionControl))

                listBoxRow.appendChild(row)


    adjustments = root.findall('object[@class="GtkAdjustment"]')
    for item in adjustments:
        interface.appendChild(_toDomElement(doc, item))

    models = root.findall('object[@class="GtkStringList"]')
    for item in models:
        interface.appendChild(_toDomElement(doc, item))

    out_str = doc.toprettyxml(indent ="  ") 
    f = open(target_file, 'w')
    f.write(out_str)
    f.close
    # print(out_str)

parseXML('ui/general.ui', 'ui/legacy/general.ui')
parseXML('ui/appearance.ui', 'ui/legacy/appearance.ui')
parseXML('ui/others.ui', 'ui/legacy/others.ui')
parseXML('ui/tweaks.ui', 'ui/legacy/tweaks.ui')