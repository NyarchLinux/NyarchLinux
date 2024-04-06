/* === This file is part of Calamares - <https://calamares.io> ===
 *
 *   SPDX-FileCopyrightText: 2015 Teo Mrnjavac <teo@kde.org>
 *   SPDX-FileCopyrightText: 2018 Adriaan de Groot <groot@kde.org>
 *   SPDX-License-Identifier: GPL-3.0-or-later
 *
 *   Calamares is Free Software: see the License-Identifier above.
 *
 *   Calamares is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 *   GNU General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License
 *   along with Calamares. If not, see <http://www.gnu.org/licenses/>.
 * 
 *   Ezarcher custom settings
 */

import QtQuick 2.0;
import calamares.slideshow 1.0;

Presentation
{
    id: presentation

    function nextSlide() {
        console.log("Process is running in the background...");
        presentation.goToNextSlide();
    }

    Timer {
        id: advanceTimer
        interval: 60000
        running: true
        repeat: true
        onTriggered: nextSlide()
    }

    Slide {
           anchors.fill: parent
        Rectangle {
            anchors.fill: parent
            border.width: 0
            color: "#051531"
            Image {
                id: slide01
                source: "slide1.png"
                fillMode: Image.PreserveAspectFit
                anchors.fill: parent
            }
        }
    }

    Slide {
           anchors.fill: parent
        Rectangle {
            anchors.fill: parent
            border.width: 0
            color: "#051531"
            Image {
                id: slide02
                source: "slide2.png"
                fillMode: Image.PreserveAspectFit
                anchors.fill: parent
            }
        }
    }

    Slide {
            anchors.fill: parent
        Rectangle {
            anchors.fill: parent
            border.width: 0
            color: "#051531"
            Image {
                id: slide03
                source: "slide3.png"
                fillMode: Image.PreserveAspectFit
                anchors.fill: parent
            }
        }
    }

    Slide {
           anchors.fill: parent
        Rectangle {
            anchors.fill: parent
            border.width: 0
            color: "#051531"
            Image {
                id: slide04
                source: "slide4.png"
                fillMode: Image.PreserveAspectFit
                anchors.fill: parent
            }
        }
    }

    Slide {
           anchors.fill: parent
        Rectangle {
            anchors.fill: parent
            border.width: 0
            color: "#051531"
            Image {
                id: slide05
                source: "slide5.png"
                fillMode: Image.PreserveAspectFit
                anchors.fill: parent
            }
        }
    }
    Slide {
           anchors.fill: parent
        Rectangle {
            anchors.fill: parent
            border.width: 0
            color: "#051531"
            Image {
                id: slide06
                source: "slide6.png"
                fillMode: Image.PreserveAspectFit
                anchors.fill: parent
            }
        }
    }
    Slide {
           anchors.fill: parent
        Rectangle {
            anchors.fill: parent
            border.width: 0
            color: "#051531"
            Image {
                id: slide07
                source: "slide7.png"
                fillMode: Image.PreserveAspectFit
                anchors.fill: parent
            }
        }
    }
    function onActivate() {
        console.log("QML Component (default slideshow) activated");
        presentation.currentSlide = 0;
    }

    function onLeave() {
        console.log("QML Component (default slideshow) deactivated");
    }
}
