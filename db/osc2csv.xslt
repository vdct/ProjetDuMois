<!DOCTYPE stylesheet [
	<!ENTITY newln "&#xA;">
]>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
	<xsl:output method="text" encoding="utf-8"/>

	<!-- Root -->
	<xsl:template match="/osmChange">
		<xsl:text>action,osmid,version,ts,user,userid,tags&newln;</xsl:text>
		<xsl:apply-templates select="create/node" />
		<xsl:apply-templates select="create/way" />
		<xsl:apply-templates select="create/relation" />
		<xsl:apply-templates select="modify/node" />
		<xsl:apply-templates select="modify/way" />
		<xsl:apply-templates select="modify/relation" />
		<xsl:apply-templates select="delete/node" />
		<xsl:apply-templates select="delete/way" />
		<xsl:apply-templates select="delete/relation" />
	</xsl:template>

	<!-- Actions -->
	<xsl:template match="create/node">
		<xsl:text>create,node/</xsl:text>
		<xsl:call-template name="feature"/>
		<xsl:text>&newln;</xsl:text>
	</xsl:template>

	<xsl:template match="create/way">
		<xsl:text>create,way/</xsl:text>
		<xsl:call-template name="feature"/>
		<xsl:text>&newln;</xsl:text>
	</xsl:template>

	<xsl:template match="create/relation">
		<xsl:text>create,relation/</xsl:text>
		<xsl:call-template name="feature"/>
		<xsl:text>&newln;</xsl:text>
	</xsl:template>

	<xsl:template match="modify/node">
		<xsl:text>modify,node/</xsl:text>
		<xsl:call-template name="feature"/>
		<xsl:text>&newln;</xsl:text>
	</xsl:template>

	<xsl:template match="modify/way">
		<xsl:text>modify,way/</xsl:text>
		<xsl:call-template name="feature"/>
		<xsl:text>&newln;</xsl:text>
	</xsl:template>

	<xsl:template match="modify/relation">
		<xsl:text>modify,relation/</xsl:text>
		<xsl:call-template name="feature"/>
		<xsl:text>&newln;</xsl:text>
	</xsl:template>

	<xsl:template match="delete/node">
		<xsl:text>delete,node/</xsl:text>
		<xsl:call-template name="feature"/>
		<xsl:text>&newln;</xsl:text>
	</xsl:template>

	<xsl:template match="delete/way">
		<xsl:text>delete,way/</xsl:text>
		<xsl:call-template name="feature"/>
		<xsl:text>&newln;</xsl:text>
	</xsl:template>

	<xsl:template match="delete/relation">
		<xsl:text>delete,relation/</xsl:text>
		<xsl:call-template name="feature"/>
		<xsl:text>&newln;</xsl:text>
	</xsl:template>

	<!-- Feature handling -->
	<xsl:template name="feature">
		<xsl:value-of select="@id" />
		<xsl:text>,</xsl:text>
		<xsl:value-of select="@version" />
		<xsl:text>,</xsl:text>
		<xsl:value-of select="@timestamp" />
		<xsl:text>,"</xsl:text>
		<xsl:call-template name="escape-string"><xsl:with-param name="s" select="@user"/></xsl:call-template>
		<xsl:text>",</xsl:text>
		<xsl:value-of select="@uid" />
		<xsl:text>,"{</xsl:text>
		<xsl:apply-templates select="tag" />
		<xsl:text>}"</xsl:text>
	</xsl:template>

	<!-- Tags handling -->
	<xsl:template match="tag">
		<xsl:text>""</xsl:text>
		<xsl:call-template name="escape-string"><xsl:with-param name="s" select="@k"/></xsl:call-template>
		<xsl:text>"":""</xsl:text>
		<xsl:call-template name="escape-string"><xsl:with-param name="s" select="@v"/></xsl:call-template>
		<xsl:text>""</xsl:text>
		<xsl:if test="following-sibling::tag">,</xsl:if>
	</xsl:template>

	<!-- Escape for key/values -->
	<xsl:template name="escape-string">
		<xsl:param name="s"/>
		<xsl:call-template name="escape-bs-string">
		<xsl:with-param name="s" select="$s"/>
		</xsl:call-template>
	</xsl:template>

	<!-- Escape the backslash (\) before everything else. -->
	<xsl:template name="escape-bs-string">
		<xsl:param name="s"/>
		<xsl:choose>
		<xsl:when test="contains($s,'\')">
			<xsl:call-template name="escape-quot-string">
			<xsl:with-param name="s" select="concat(substring-before($s,'\'),'\\')"/>
			</xsl:call-template>
			<xsl:call-template name="escape-bs-string">
			<xsl:with-param name="s" select="substring-after($s,'\')"/>
			</xsl:call-template>
		</xsl:when>
		<xsl:otherwise>
			<xsl:call-template name="escape-quot-string">
			<xsl:with-param name="s" select="$s"/>
			</xsl:call-template>
		</xsl:otherwise>
		</xsl:choose>
	</xsl:template>

	<!-- Escape the double quote ("). -->
	<xsl:template name="escape-quot-string">
		<xsl:param name="s"/>
		<xsl:choose>
		<xsl:when test="contains($s,'&quot;')">
			<xsl:call-template name="encode-string">
			<xsl:with-param name="s" select="concat(substring-before($s,'&quot;'),'\&quot;&quot;')"/>
			</xsl:call-template>
			<xsl:call-template name="escape-quot-string">
			<xsl:with-param name="s" select="substring-after($s,'&quot;')"/>
			</xsl:call-template>
		</xsl:when>
		<xsl:otherwise>
			<xsl:call-template name="encode-string">
			<xsl:with-param name="s" select="$s"/>
			</xsl:call-template>
		</xsl:otherwise>
		</xsl:choose>
	</xsl:template>

	<xsl:template name="encode-string">
		<xsl:param name="s"/>
		<xsl:choose>
		<xsl:when test="contains($s,'&#x9;')">
			<xsl:call-template name="encode-string">
			<xsl:with-param name="s" select="concat(substring-before($s,'&#x9;'),'\t',substring-after($s,'&#x9;'))"/>
			</xsl:call-template>
		</xsl:when>
		<xsl:when test="contains($s,'&#xA;')">
			<xsl:call-template name="encode-string">
			<xsl:with-param name="s" select="concat(substring-before($s,'&#xA;'),'\n',substring-after($s,'&#xA;'))"/>
			</xsl:call-template>
		</xsl:when>
		<xsl:when test="contains($s,'&#xD;')">
			<xsl:call-template name="encode-string">
			<xsl:with-param name="s" select="concat(substring-before($s,'&#xD;'),'\r',substring-after($s,'&#xD;'))"/>
			</xsl:call-template>
		</xsl:when>
		<xsl:otherwise><xsl:value-of select="$s"/></xsl:otherwise>
		</xsl:choose>
	</xsl:template>
</xsl:stylesheet>

