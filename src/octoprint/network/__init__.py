# coding=utf-8
__author__ = "Daniel Arroyo <daniel@3dagogo.com>"
__license__ = 'GNU Affero General Public License http://www.gnu.org/licenses/agpl.html'

from octoprint.settings import settings

from sys import platform

class NetworkManager(object):
	def __init__(self):
		self.settings = settings()

	def getWifiNetworks(self):
		return None

	def getActiveWifiNetwork(self):
		return None

	def setWifiNetwork(self, bssid, password):
		return None

	def isHotspotActive(self):
		return None

def loader():
	if platform == "linux" or platform == "linux2":
		from octoprint.network.ubuntu import UbuntuNetworkManager
		return UbuntuNetworkManager()
	else:
		return NetworkManager()