<map version="freeplane 1.3.0">
<!--To view this file, download free mind mapping software Freeplane from http://freeplane.sourceforge.net -->
<node TEXT="My tasks" LOCALIZED_STYLE_REF="AutomaticLayout.level.root" ID="ID_1723255651" CREATED="1283093380553" MODIFIED="1427226124888"><hook NAME="MapStyle">
    <properties show_icon_for_attributes="true"/>

<map_styles>
<stylenode LOCALIZED_TEXT="styles.root_node">
<stylenode LOCALIZED_TEXT="styles.predefined" POSITION="right">
<stylenode LOCALIZED_TEXT="default" MAX_WIDTH="600" COLOR="#000000" STYLE="as_parent">
<font NAME="Calibri" SIZE="10" BOLD="false" ITALIC="false"/>
<edge STYLE="bezier" WIDTH="thin"/>
</stylenode>
<stylenode LOCALIZED_TEXT="defaultstyle.details"/>
<stylenode LOCALIZED_TEXT="defaultstyle.note"/>
<stylenode LOCALIZED_TEXT="defaultstyle.floating">
<edge STYLE="hide_edge"/>
<cloud COLOR="#f0f0f0" SHAPE="ROUND_RECT"/>
</stylenode>
</stylenode>
<stylenode LOCALIZED_TEXT="styles.user-defined" POSITION="right">
<stylenode LOCALIZED_TEXT="styles.topic" COLOR="#18898b" STYLE="fork">
<font NAME="Liberation Sans" SIZE="10" BOLD="true"/>
</stylenode>
<stylenode LOCALIZED_TEXT="styles.subtopic" COLOR="#cc3300" STYLE="fork">
<font NAME="Liberation Sans" SIZE="10" BOLD="true"/>
</stylenode>
<stylenode LOCALIZED_TEXT="styles.subsubtopic" COLOR="#669900">
<font NAME="Liberation Sans" SIZE="10" BOLD="true"/>
</stylenode>
<stylenode LOCALIZED_TEXT="styles.important">
<icon BUILTIN="yes"/>
</stylenode>
</stylenode>
<stylenode LOCALIZED_TEXT="styles.AutomaticLayout" POSITION="right">
<stylenode LOCALIZED_TEXT="AutomaticLayout.level.root" COLOR="#000000" BACKGROUND_COLOR="#fefc74">
<font SIZE="18"/>
</stylenode>
<stylenode LOCALIZED_TEXT="AutomaticLayout.level,1" COLOR="#0033ff">
<font SIZE="16"/>
</stylenode>
<stylenode LOCALIZED_TEXT="AutomaticLayout.level,2" COLOR="#00b439">
<font SIZE="14"/>
</stylenode>
<stylenode LOCALIZED_TEXT="AutomaticLayout.level,3" COLOR="#990000">
<font SIZE="12"/>
</stylenode>
<stylenode LOCALIZED_TEXT="AutomaticLayout.level,4" COLOR="#111111">
<font SIZE="10"/>
</stylenode>
</stylenode>
</stylenode>
</map_styles>
</hook>
<hook NAME="AutomaticEdgeColor" COUNTER="8"/>
<node TEXT="Config" LOCALIZED_STYLE_REF="styles.topic" POSITION="left" ID="ID_867421423" CREATED="1427226495651" MODIFIED="1427227152051">
<edge COLOR="#7c0000"/>
<node TEXT="Icon: @Computer" ID="ID_1821210832" CREATED="1427226511560" MODIFIED="1427226607171">
<icon BUILTIN="male1"/>
</node>
<node TEXT="Icon: @email" ID="ID_368331860" CREATED="1427226532275" MODIFIED="1427226613079">
<icon BUILTIN="Mail"/>
</node>
<node TEXT="Icon: @Meeting" ID="ID_1136940334" CREATED="1427226567638" MODIFIED="1427226653217">
<icon BUILTIN="group"/>
</node>
<node TEXT="Icon: @Home" ID="ID_635308207" CREATED="1427226636588" MODIFIED="1427226659054">
<icon BUILTIN="gohome"/>
</node>
<node TEXT="Icon: task" ID="ID_1885720904" CREATED="1447680866989" MODIFIED="1447680881570">
<icon BUILTIN="ksmiletris"/>
</node>
<node TEXT="Icon: Project" ID="ID_1727032609" CREATED="1447680882834" MODIFIED="1447680892288">
<icon BUILTIN="penguin"/>
</node>
</node>
<node TEXT="Test" POSITION="right" ID="ID_528722908" CREATED="1447323008857" MODIFIED="1447323239496">
<edge COLOR="#00007c"/>
<node TEXT="*@Meeing[Dogbert]Just{5minutes}@Hell#12" ID="ID_1976506990" CREATED="1447323014991" MODIFIED="1447323063711"/>
<node TEXT="*#41@Meeting[Catbert]Just{5minutes}@Hell#2@Hell#42" ID="ID_1221496068" CREATED="1447323014991" MODIFIED="1447323141991"/>
<node TEXT="*This@Context#1Will{today}be wrong" ID="ID_254804742" CREATED="1447323146784" MODIFIED="1447323217931"/>
<node TEXT="*This should be converted to task with two contexts @Home" ID="ID_875861497" CREATED="1447680896287" MODIFIED="1447680958564">
<icon BUILTIN="ksmiletris"/>
<icon BUILTIN="group"/>
</node>
<node TEXT="*This should be converted to task with one context @Home" ID="ID_1546734060" CREATED="1447680970705" MODIFIED="1447681001453">
<icon BUILTIN="gohome"/>
<attribute NAME="Where" VALUE="Home"/>
</node>
<node TEXT="*This should be converted to task with three contexts @Home" ID="ID_1166725155" CREATED="1447680896287" MODIFIED="1447681035469">
<icon BUILTIN="ksmiletris"/>
<icon BUILTIN="group"/>
<attribute NAME="Where" VALUE="LongFocus"/>
</node>
<node TEXT="This should overwrite the already set date {now}" ID="ID_17589400" CREATED="1447682842206" MODIFIED="1447682886333">
<icon BUILTIN="ksmiletris"/>
<attribute NAME="When" VALUE="Yesterday"/>
</node>
</node>
</node>
</map>
