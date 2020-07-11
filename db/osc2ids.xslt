<!DOCTYPE stylesheet [
	<!ENTITY newln "&#xA;">
]>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
	<xsl:output method="text" encoding="utf-8"/>

	<!-- Root -->
	<xsl:template match="/osmChange">
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
		<xsl:text>n</xsl:text>
		<xsl:call-template name="feature"/>
		<xsl:text>&newln;</xsl:text>
	</xsl:template>

	<xsl:template match="create/way">
		<xsl:text>w</xsl:text>
		<xsl:call-template name="feature"/>
		<xsl:text>&newln;</xsl:text>
	</xsl:template>

	<xsl:template match="create/relation">
		<xsl:text>r</xsl:text>
		<xsl:call-template name="feature"/>
		<xsl:text>&newln;</xsl:text>
	</xsl:template>

	<xsl:template match="modify/node">
		<xsl:text>n</xsl:text>
		<xsl:call-template name="feature"/>
		<xsl:text>&newln;</xsl:text>
	</xsl:template>

	<xsl:template match="modify/way">
		<xsl:text>w</xsl:text>
		<xsl:call-template name="feature"/>
		<xsl:text>&newln;</xsl:text>
	</xsl:template>

	<xsl:template match="modify/relation">
		<xsl:text>r</xsl:text>
		<xsl:call-template name="feature"/>
		<xsl:text>&newln;</xsl:text>
	</xsl:template>

	<xsl:template match="delete/node">
		<xsl:text>n</xsl:text>
		<xsl:call-template name="feature"/>
		<xsl:text>&newln;</xsl:text>
	</xsl:template>

	<xsl:template match="delete/way">
		<xsl:text>w</xsl:text>
		<xsl:call-template name="feature"/>
		<xsl:text>&newln;</xsl:text>
	</xsl:template>

	<xsl:template match="delete/relation">
		<xsl:text>r</xsl:text>
		<xsl:call-template name="feature"/>
		<xsl:text>&newln;</xsl:text>
	</xsl:template>

	<!-- Feature handling -->
	<xsl:template name="feature">
		<xsl:value-of select="@id" />
	</xsl:template>
</xsl:stylesheet>

